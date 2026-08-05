"""
HUD Data Downloader
Downloads CSV files from HUD Exchange for Point-in-Time counts and System Performance Measures
"""
import requests
import os
import pandas as pd
from typing import Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HUDDataDownloader:
    BASE_URL = "https://files.hudexchange.info/resources/"
    
    def __init__(self, output_dir: str = "data/raw"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def download_pit_data(self, year: int) -> Optional[str]:
        """
        Download Point-in-Time count data for a specific year.
        
        Args:
            year: Year of data to download (e.g., 2023)
            
        Returns:
            Path to downloaded file or None if failed
        """
        # HUD PIT data URLs (these are example URLs - actual URLs may vary)
        pit_urls = {
            2023: "https://files.hudexchange.info/resources/documents/PIT-2023.csv",
            2022: "https://files.hudexchange.info/resources/documents/PIT-2022.csv",
            2021: "https://files.hudexchange.info/resources/documents/PIT-2021.csv"
        }
        
        if year not in pit_urls:
            logger.error(f"No PIT data URL available for year {year}")
            return None
        
        url = pit_urls[year]
        filename = f"pit_data_{year}.csv"
        filepath = os.path.join(self.output_dir, filename)
        
        return self._download_file(url, filepath)
    
    def download_spm_data(self, year: int) -> Optional[str]:
        """
        Download System Performance Measures data for a specific year.
        
        Args:
            year: Year of data to download
            
        Returns:
            Path to downloaded file or None if failed
        """
        spm_urls = {
            2023: "https://files.hudexchange.info/resources/documents/SPM-2023.csv",
            2022: "https://files.hudexchange.info/resources/documents/SPM-2022.csv",
            2021: "https://files.hudexchange.info/resources/documents/SPM-2021.csv"
        }
        
        if year not in spm_urls:
            logger.error(f"No SPM data URL available for year {year}")
            return None
        
        url = spm_urls[year]
        filename = f"spm_data_{year}.csv"
        filepath = os.path.join(self.output_dir, filename)
        
        return self._download_file(url, filepath)
    
    def download_coc_boundaries(self) -> Optional[str]:
        """
        Download Continuum of Care geographic boundaries.
        
        Returns:
            Path to downloaded file or None if failed
        """
        url = "https://files.hudexchange.info/resources/documents/CoC_Boundaries.geojson"
        filename = "coc_boundaries.geojson"
        filepath = os.path.join(self.output_dir, filename)
        
        return self._download_file(url, filepath)
    
    def _download_file(self, url: str, filepath: str) -> Optional[str]:
        """
        Download a file from URL to local path.
        
        Args:
            url: URL to download from
            filepath: Local path to save file
            
        Returns:
            Filepath if successful, None otherwise
        """
        try:
            logger.info(f"Downloading {url}")
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            logger.info(f"Successfully downloaded to {filepath}")
            return filepath
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to download {url}: {e}")
            return None

if __name__ == "__main__":
    downloader = HUDDataDownloader()
    
    # Download latest available data
    downloader.download_pit_data(2023)
    downloader.download_spm_data(2023)
    downloader.download_coc_boundaries()