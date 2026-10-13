import os
import pandas as pd
from googleapiclient.discovery import build
from google.oauth2 import service_account

class GSCConnector:
    def __init__(self):
        self.credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "./config/credentials.json")
        self.site_url = os.getenv("GSC_SITE_URL", "")
        
    def get_search_analytics(self, start_date: str, end_date: str, dimensions=['query']) -> pd.DataFrame:
        """Consulta los datos de rendimiento de Google Search Console."""
        if not os.path.exists(self.credentials_path):
            raise FileNotFoundError(f"No se encontró el archivo de credenciales en {self.credentials_path}")
            
        credentials = service_account.Credentials.from_service_account_file(
            self.credentials_path, 
            scopes=['https://www.googleapis.com/auth/webmasters.readonly']
        )
        
        service = build('searchconsole', 'v1', credentials=credentials)
        
        request = {
            'startDate': start_date,
            'endDate': end_date,
            'dimensions': dimensions,
            'rowLimit': 1000
        }
        
        response = service.searchanalytics().query(siteUrl=self.site_url, body=request).execute()
        rows = response.get('rows', [])
        
        if not rows:
            return pd.DataFrame()
            
        data = []
        for row in rows:
            data.append({
                'Dimension': row['keys'][0],
                'Clicks': row['clicks'],
                'Impressions': row['impressions'],
                'CTR': row['ctr'],
                'Position': row['position']
            })
            
        return pd.DataFrame(data)
