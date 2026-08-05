"""
Database Loader
Loads processed data into PostgreSQL database
"""
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import logging
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatabaseLoader:
    def __init__(self):
        self.conn_params = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432'),
            'database': os.getenv('DB_NAME', 'homelessness_kpi'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD', 'postgres')
        }
    
    def get_connection(self):
        """Create database connection"""
        return psycopg2.connect(**self.conn_params, cursor_factory=RealDictCursor)
    
    def load_coc_data(self, df: pd.DataFrame) -> int:
        """
        Load Continuum of Care data into database.
        
        Args:
            df: DataFrame with CoC data
            
        Returns:
            Number of records inserted
        """
        if df is None or len(df) == 0:
            logger.warning("No CoC data to load")
            return 0
        
        query = """
            INSERT INTO continuums_of_care (coc_id, name, state, region_type, population)
            VALUES (%(coc_id)s, %(name)s, %(state)s, %(region_type)s, %(population)s)
            ON CONFLICT (coc_id) DO UPDATE SET
                name = EXCLUDED.name,
                state = EXCLUDED.state,
                region_type = EXCLUDED.region_type,
                population = EXCLUDED.population,
                updated_at = CURRENT_TIMESTAMP
        """
        
        count = 0
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                for _, row in df.iterrows():
                    cur.execute(query, {
                        'coc_id': row.get('coc_id'),
                        'name': row.get('name', ''),
                        'state': row.get('state', ''),
                        'region_type': row.get('region_type', 'unknown'),
                        'population': row.get('population') if pd.notna(row.get('population')) else None
                    })
                    count += 1
                conn.commit()
                logger.info(f"Loaded {count} CoC records")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error loading CoC data: {e}")
            raise
        finally:
            conn.close()
        
        return count
    
    def load_metrics(self, df: pd.DataFrame) -> int:
        """
        Load metrics data into database.
        
        Args:
            df: DataFrame with metrics data
            
        Returns:
            Number of records inserted
        """
        if df is None or len(df) == 0:
            logger.warning("No metrics data to load")
            return 0
        
        query = """
            INSERT INTO metrics (coc_id, metric_type, year, value, unit, source)
            VALUES (%(coc_id)s, %(metric_type)s, %(year)s, %(value)s, %(unit)s, %(source)s)
            ON CONFLICT (coc_id, metric_type, year) DO UPDATE SET
                value = EXCLUDED.value,
                unit = EXCLUDED.unit,
                source = EXCLUDED.source,
                updated_at = CURRENT_TIMESTAMP
        """
        
        count = 0
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                for _, row in df.iterrows():
                    cur.execute(query, {
                        'coc_id': row.get('coc_id'),
                        'metric_type': row.get('metric_type'),
                        'year': row.get('year'),
                        'value': row.get('value'),
                        'unit': row.get('unit', 'count'),
                        'source': row.get('source', 'HUD Exchange')
                    })
                    count += 1
                conn.commit()
                logger.info(f"Loaded {count} metric records")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error loading metrics data: {e}")
            raise
        finally:
            conn.close()
        
        return count
    
    def calculate_functional_zero_status(self):
        """
        Calculate and update Functional Zero status for all CoCs.
        """
        query = """
            WITH coc_populations AS (
                SELECT 
                    c.coc_id,
                    c.population,
                    COALESCE(m.value, 0) as homeless_population
                FROM continuums_of_care c
                LEFT JOIN metrics m ON c.coc_id = m.coc_id 
                    AND m.metric_type = 'pit_count' 
                    AND m.year = 2023
            )
            INSERT INTO functional_zero_status (coc_id, status, current_population, benchmark_population, percentage_change, rate_per_10k)
            SELECT 
                cp.coc_id,
                CASE 
                    WHEN cp.population > 0 AND (cp.homeless_population / cp.population * 10000) < 3 
                    THEN 'functional_zero'
                    WHEN cp.population > 0 AND (cp.homeless_population / cp.population * 10000) < 5
                    THEN 'approaching'
                    ELSE 'not_achieved'
                END as status,
                cp.homeless_population as current_population,
                CASE WHEN cp.population > 0 THEN (cp.population / 10000 * 3)::int ELSE 0 END as benchmark_population,
                CASE WHEN cp.population > 0 AND (cp.homeless_population / cp.population * 10000) > 0 
                     THEN ((cp.homeless_population - (cp.population / 10000 * 3)) / (cp.population / 10000 * 3) * 100)
                     ELSE 0 END as percentage_change,
                CASE WHEN cp.population > 0 THEN (cp.homeless_population / cp.population * 10000) ELSE 0 END as rate_per_10k
            FROM coc_populations cp
            ON CONFLICT (coc_id, last_updated) DO NOTHING
        """
        
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(query)
                conn.commit()
                logger.info("Updated Functional Zero status for all CoCs")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error calculating Functional Zero status: {e}")
            raise
        finally:
            conn.close()

if __name__ == "__main__":
    loader = DatabaseLoader()
    
    # Load processed data
    processed_dir = "data/processed"
    
    # Load CoC reference data
    coc_file = os.path.join(processed_dir, "coc_reference_2023.csv")
    if os.path.exists(coc_file):
        coc_df = pd.read_csv(coc_file)
        loader.load_coc_data(coc_df)
    
    # Load metrics data
    metrics_file = os.path.join(processed_dir, "pit_metrics_2023.csv")
    if os.path.exists(metrics_file):
        metrics_df = pd.read_csv(metrics_file)
        loader.load_metrics(metrics_df)
    
    # Calculate Functional Zero status
    loader.calculate_functional_zero_status()