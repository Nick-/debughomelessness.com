"""
Data Processor
Cleans and transforms HUD CSV data for database insertion
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataProcessor:
    def __init__(self, raw_data_dir: str = "data/raw", processed_data_dir: str = "data/processed"):
        self.raw_data_dir = raw_data_dir
        self.processed_data_dir = processed_data_dir
        os.makedirs(processed_data_dir, exist_ok=True)
    
    def process_pit_data(self, year: int) -> Optional[pd.DataFrame]:
        """
        Process Point-in-Time count data.
        
        Args:
            year: Year of data to process
            
        Returns:
            Processed DataFrame or None if failed
        """
        filepath = os.path.join(self.raw_data_dir, f"pit_data_{year}.csv")
        
        if not os.path.exists(filepath):
            logger.error(f"PIT data file not found: {filepath}")
            return None
        
        try:
            df = pd.read_csv(filepath)
            
            # Standardize column names
            df.columns = df.columns.str.lower().str.replace(' ', '_')
            
            # Clean CoC IDs (remove whitespace, ensure proper format)
            if 'coc_id' in df.columns:
                df['coc_id'] = df['coc_id'].str.strip().str.upper()
            
            # Handle missing values
            df = df.replace([np.inf, -np.inf], np.nan)
            
            # Convert numeric columns
            numeric_columns = ['sheltered', 'unsheltered', 'total', 'year']
            for col in numeric_columns:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            
            # Add year column if not present
            if 'year' not in df.columns:
                df['year'] = year
            
            # Filter out rows with missing CoC IDs
            if 'coc_id' in df.columns:
                df = df.dropna(subset=['coc_id'])
            
            logger.info(f"Processed PIT data for {year}: {len(df)} records")
            return df
            
        except Exception as e:
            logger.error(f"Error processing PIT data: {e}")
            return None
    
    def process_spm_data(self, year: int) -> Optional[pd.DataFrame]:
        """
        Process System Performance Measures data.
        
        Args:
            year: Year of data to process
            
        Returns:
            Processed DataFrame or None if failed
        """
        filepath = os.path.join(self.raw_data_dir, f"spm_data_{year}.csv")
        
        if not os.path.exists(filepath):
            logger.error(f"SPM data file not found: {filepath}")
            return None
        
        try:
            df = pd.read_csv(filepath)
            
            # Standardize column names
            df.columns = df.columns.str.lower().str.replace(' ', '_')
            
            # Clean CoC IDs
            if 'coc_id' in df.columns:
                df['coc_id'] = df['coc_id'].str.strip().str.upper()
            
            # Handle missing values
            df = df.replace([np.inf, -np.inf], np.nan)
            
            # Convert numeric columns
            numeric_columns = ['length_of_homelessness', 'placement_rate', 'recidivism_rate', 'year']
            for col in numeric_columns:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            
            # Add year column if not present
            if 'year' not in df.columns:
                df['year'] = year
            
            # Filter out rows with missing CoC IDs
            if 'coc_id' in df.columns:
                df = df.dropna(subset=['coc_id'])
            
            logger.info(f"Processed SPM data for {year}: {len(df)} records")
            return df
            
        except Exception as e:
            logger.error(f"Error processing SPM data: {e}")
            return None
    
    def normalize_coc_data(self, pit_df: pd.DataFrame, spm_df: pd.DataFrame) -> Dict[str, pd.DataFrame]:
        """
        Normalize and combine CoC data from different sources.
        
        Args:
            pit_df: Processed PIT data
            spm_df: Processed SPM data
            
        Returns:
            Dictionary of normalized DataFrames
        """
        normalized = {}
        
        # Create CoC reference table
        coc_ids = set()
        if pit_df is not None and 'coc_id' in pit_df.columns:
            coc_ids.update(pit_df['coc_id'].unique())
        if spm_df is not None and 'coc_id' in spm_df.columns:
            coc_ids.update(spm_df['coc_id'].unique())
        
        # Create basic CoC reference
        coc_reference = pd.DataFrame({
            'coc_id': list(coc_ids),
            'name': '',  # Will be filled from boundary data
            'state': '',  # Will be filled from boundary data
            'region_type': 'unknown'
        })
        
        normalized['coc_reference'] = coc_reference
        
        # Normalize metrics data
        if pit_df is not None:
            normalized['pit_metrics'] = self._normalize_metrics(pit_df, 'pit_count')
        
        if spm_df is not None:
            normalized['spm_metrics'] = self._normalize_metrics(spm_df, 'spm')
        
        return normalized
    
    def _normalize_metrics(self, df: pd.DataFrame, metric_type: str) -> pd.DataFrame:
        """
        Normalize metrics data to standard format.
        
        Args:
            df: Source DataFrame
            metric_type: Type of metric (pit_count, spm_length, etc.)
            
        Returns:
            Normalized DataFrame
        """
        # Map columns to standard format
        column_mapping = {
            'coc_id': 'coc_id',
            'year': 'year',
            'total': 'value',
            'sheltered': 'value',
            'unsheltered': 'value',
            'length_of_homelessness': 'value',
            'placement_rate': 'value',
            'recidivism_rate': 'value'
        }
        
        # Create normalized DataFrame
        normalized_rows = []
        
        for _, row in df.iterrows():
            if 'coc_id' not in row or pd.isna(row['coc_id']):
                continue
            
            base_row = {
                'coc_id': row['coc_id'],
                'year': row.get('year', 2023),
                'metric_type': metric_type,
                'value': None,
                'unit': 'count' if 'pit' in metric_type else 'percentage',
                'source': 'HUD Exchange'
            }
            
            # Try to find the value column
            for old_col, new_col in column_mapping.items():
                if old_col in row and not pd.isna(row[old_col]) and new_col == 'value':
                    base_row['value'] = row[old_col]
                    break
            
            if base_row['value'] is not None:
                normalized_rows.append(base_row)
        
        return pd.DataFrame(normalized_rows)
    
    def save_processed_data(self, data: Dict[str, pd.DataFrame], year: int):
        """
        Save processed data to files.
        
        Args:
            data: Dictionary of DataFrames to save
            year: Year of data
        """
        for name, df in data.items():
            if df is not None and len(df) > 0:
                filepath = os.path.join(self.processed_data_dir, f"{name}_{year}.csv")
                df.to_csv(filepath, index=False)
                logger.info(f"Saved {name} to {filepath}")

if __name__ == "__main__":
    processor = DataProcessor()
    
    # Process available data
    pit_data = processor.process_pit_data(2023)
    spm_data = processor.process_spm_data(2023)
    
    if pit_data is not None or spm_data is not None:
        normalized = processor.normalize_coc_data(pit_data, spm_data)
        processor.save_processed_data(normalized, 2023)