import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
import os
import sys

# Añadir ruta raíz para importar conectores
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from connectors.gsc_api import GSCConnector

st.set_page_config(
    page_title="DATO SEO AI — Dashboard GSC",
    page_icon="🚀",
    layout="wide"
)

# Tema oscuro y estilos corporativos
st.markdown("""
    <style>
    .main { background-color: #0e1117; color: #ffffff; }
    .metric-card { background-color: #161b22; padding: 20px; border-radius: 10px; border: 1px solid #30363d; }
    </style>
""", unsafe_allow_html=True)

st.title("🚀 DATO SEO AI — Google Search Console Dashboard")
st.markdown(f"**Propiedad analizada:** `{os.getenv('GSC_SITE_URL', 'No configurada')}`")

# Filtros de fecha en la barra lateral
st.sidebar.header("Filtros de Periodo")
dias_atras = st.sidebar.slider("Días hacia atrás a analizar:", min_value=7, max_value=90, value=28)

end_date = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d') # GSC suele tener 3 días de delay
start_date = (datetime.now() - timedelta(days=dias_atras + 3)).strftime('%Y-%m-%d')

st.sidebar.text(f"Desde: {start_date}")
st.sidebar.text(f"Hasta: {end_date}")

# Botón para cargar datos
if st.button("🔄 Consultar Datos en Vivo a GSC"):
    with st.spinner("Conectando con la API de Google Search Console..."):
        try:
            gsc = GSCConnector()
            df = gsc.get_search_analytics(start_date, end_date, dimensions=['query'])
            
            if not df.empty:
                st.session_state['gsc_data'] = df
                st.success("¡Datos cargados correctamente desde GSC!")
            else:
                st.warning("No se devolvieron datos para el periodo seleccionado.")
        except Exception as e:
            st.error(f"Error al conectar con la API: {e}")

# Mostrar métricas y tablas si los datos están en sesión
if 'gsc_data' in st.session_state:
    df = st.session_state['gsc_data']
    
    # KPIs Principales
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Clics Totales", f"{df['Clicks'].sum():,}")
    col2.metric("Impresiones Totales", f"{df['Impressions'].sum():,}")
    col3.metric("CTR Promedio", f"{(df['CTR'].mean() * 100):.2f}%")
    col4.metric("Posición Media", f"{df['Position'].mean():.1f}")
    
    st.markdown("---")
    
    # Tabla de consultas principales
    st.subheader("🔍 Principales Consultas de Búsqueda (Keywords)")
    st.dataframe(df.sort_values(by='Clicks', ascending=False), use_container_width=True)
    
    # Detección rápida de Quick Wins (Posiciones 4 a 15 con buenas impresiones)
    st.subheader("⚡ Oportunidades 'Quick Wins' (Posición 4 a 15)")
    quick_wins = df[(df['Position'] >= 4.0) & (df['Position'] <= 15.0)].sort_values(by='Impressions', ascending=False)
    st.dataframe(quick_wins.head(15), use_container_width=True)
