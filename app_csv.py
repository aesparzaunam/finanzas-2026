import streamlit as st
import pandas as pd
import datetime
import os
import altair as alt

# --- CONFIGURACIÓN UI PRO ---
st.set_page_config(
    page_title="Finanzas 2026",
    layout="wide",
    page_icon="💳",
    initial_sidebar_state="collapsed"
)

# Estilos CSS
st.markdown("""
    <style>
        .block-container {padding-top: 1rem; padding-bottom: 2rem;}
        [data-testid="stMetricValue"] {font-size: 1.6rem !important;}
        /* Estilo para los uploaders en móvil */
        [data-testid="stFileUploader"] {padding: 10px; border: 1px dashed #4CAF50; border-radius: 10px;}
    </style>
""", unsafe_allow_html=True)

FILE_MOVS = 'movimientos_2026.csv'
FILE_PRESUPUESTO = 'presupuesto_2026.csv'

# --- FUNCIONES ---
def cargar_datos(archivo, columnas):
    if not os.path.exists(archivo):
        return pd.DataFrame(columns=columnas)
    return pd.read_csv(archivo)

def guardar_datos(df, archivo):
    df.to_csv(archivo, index=False)

# Columnas y Categorías
COLS_MOVS = ['Fecha', 'Tipo', 'Categoria', 'Concepto', 'Monto']
COLS_PRES = ['Categoria', 'Limite_Mensual']

CATEGORIAS = [
    "Vivienda (Renta/Mtto)", "Servicios (Luz/Agua/Gas)", "Telecom (Telcel/Internet)", "Celdas Solares", 
    "Supermercado", "Comidas Fuera (Restaurantes)", "Delivery (Rappi/UberEats)", 
    "Auto (Gasolina/Casetas)", "Crédito Auto (BYD)", "Mantenimiento Auto/Trámites", "Transporte App (Uber/Didi)", 
    "Salud (Médico/Farmacia)", "Psicóloga", "Cuidado Personal (Barber/Ropa)", "Mascotas (Veterinaria/Alimento)", 
    "Suscripciones (Netflix/Spotify/YouTube)", "Software/AI (ChatGPT/iCloud)", "Tecnología (Gadgets/Computación)", 
    "Pago Tarjeta (BBVA/AMEX/Banorte)", "Préstamos Personales (Paco/PAX)", "Créditos Bancarios", "Ahorro/Inversión (Cetes/Apartados)", 
    "Diversión & Salidas", "Viajes & Vacaciones", 
    "Nómina (UNAM)", "Otros Ingresos (Bonos/Aguinaldo)", "Préstamos Recibidos"
]

# --- BARRA LATERAL: GESTIÓN DE ARCHIVOS (CRUCIAL) ---
with st.sidebar:
    st.title("📂 Gestión de Datos")
    
    st.info("ℹ️ Si la app se reinició, carga tu último respaldo aquí para recuperar tu historial.")
    
    with st.expander("📤 CARGAR RESPALDO (Restaurar)", expanded=True):
        # Uploader para Movimientos
        uploaded_movs = st.file_uploader("1. Archivo de Movimientos (.csv)", type="csv", key="up_movs")
        if uploaded_movs is not None:
            try:
                # Leemos y sobrescribimos el archivo local
                df_up = pd.read_csv(uploaded_movs)
                # Validar columnas mínimas
                if all(col in df_up.columns for col in COLS_MOVS):
                    guardar_datos(df_up, FILE_MOVS)
                    st.success("✅ Historial recuperado")
                else:
                    st.error("El archivo no tiene el formato correcto.")
            except Exception as e:
                st.error(f"Error: {e}")

        # Uploader para Presupuesto
        uploaded_pres = st.file_uploader("2. Archivo de Presupuesto (.csv)", type="csv", key="up_pres")
        if uploaded_pres is not None:
            try:
                df_up_p = pd.read_csv(uploaded_pres)
                guardar_datos(df_up_p, FILE_PRESUPUESTO)
                st.success("✅ Presupuestos recuperados")
            except:
                st.error("Error al cargar presupuesto")

    st.divider()
    
    st.subheader("💾 Guardar Cambios")
    # Botón de Descarga (Siempre visible en sidebar)
    df_down = cargar_datos(FILE_MOVS, COLS_MOVS)
    if not df_down.empty:
        csv = df_down.to_csv(index=False).encode('utf-8')
        st.download_button(
            label="📥 DESCARGAR RESPALDO ACTUAL",
            data=csv,
            file_name=f"finanzas_respaldo_{datetime.date.today()}.csv",
            mime="text/csv",
            type="primary" # Botón destacado
        )
        
    # Descarga de Presupuesto (Opcional)
    df_pres_down = cargar_datos(FILE_PRESUPUESTO, COLS_PRES)
    if not df_pres_down.empty:
        csv_p = df_pres_down.to_csv(index=False).encode('utf-8')
        st.download_button(
            label="📥 Descargar Presupuesto",
            data=csv_p,
            file_name="presupuesto_respaldo.csv",
            mime="text/csv"
        )

# --- PANTALLA PRINCIPAL ---
st.title("💳 Control Financiero")

# --- SECCIÓN 1: FORMULARIO ---
with st.container():
    with st.expander("➕ **NUEVO MOVIMIENTO** (Toca para abrir)", expanded=True):
        with st.form("entry_form", clear_on_submit=True):
            c1, c2 = st.columns(2)
            fecha = c1.date_input("Fecha", datetime.date.today())
            tipo = c2.radio("Tipo", ["Gasto", "Ingreso"], horizontal=True)
            
            df_pres = cargar_datos(FILE_PRESUPUESTO, COLS_PRES)
            cat_list = sorted(list(set(CATEGORIAS + df_pres['Categoria'].tolist()))) if not df_pres.empty else CATEGORIAS
            
            categoria = st.selectbox("Categoría", cat_list)
            
            c3, c4 = st.columns([2, 1])
            concepto = c3.text_input("Concepto (Opcional)")
            monto = c4.number_input("Monto ($)", min_value=0.0, step=10.0)
            
            if st.form_submit_button("💾 Guardar", type="primary", use_container_width=True):
                if monto > 0:
                    df_movs = cargar_datos(FILE_MOVS, COLS_MOVS)
                    nuevo_reg = pd.DataFrame([{
                        'Fecha': fecha, 'Tipo': tipo, 'Categoria': categoria, 
                        'Concepto': concepto, 'Monto': monto
                    }])
                    df_movs = pd.concat([df_movs, nuevo_reg], ignore_index=True)
                    guardar_datos(df_movs, FILE_MOVS)
                    st.toast(f"✅ ¡{tipo} registrado!", icon='🎉')
                    st.rerun()
                else:
                    st.toast("⚠️ Monto inválido", icon='❌')

# --- SECCIÓN 2: PESTAÑAS ---
st.write(" ")
tab_dash, tab_pres, tab_data = st.tabs(["📊 Dashboard", "⚙️ Metas", "📋 Historial"])

# === TAB 1: DASHBOARD ===
with tab_dash:
    df = cargar_datos(FILE_MOVS, COLS_MOVS)
    
    if df.empty:
        st.info("👋 La app se ha reiniciado o es nueva. Abre el MENÚ LATERAL (arriba izquierda >) para cargar tu respaldo o registra un gasto nuevo.")
    else:
        df['Fecha'] = pd.to_datetime(df['Fecha'])
        
        col_filtro, _ = st.columns([1, 2])
        mes_sel = col_filtro.date_input("📅 Mes:", datetime.date.today())
        
        mask = (df['Fecha'].dt.year == mes_sel.year) & (df['Fecha'].dt.month == mes_sel.month)
        df_mes = df[mask]
        
        ingresos = df_mes[df_mes['Tipo'] == 'Ingreso']['Monto'].sum()
        gastos = df_mes[df_mes['Tipo'] == 'Gasto']['Monto'].sum()
        balance = ingresos - gastos
        
        k1, k2, k3 = st.columns(3)
        k1.metric("Ingresos", f"${ingresos:,.2f}")
        k2.metric("Gastos", f"${gastos:,.2f}", delta=-gastos, delta_color="inverse")
        k3.metric("Balance", f"${balance:,.2f}", delta_color="normal")
        
        st.divider()
        
        c_graf, c_sem = st.columns([1, 1], gap="medium")
        
        with c_graf:
            st.subheader("🍩 Distribución")
            if gastos > 0:
                df_g = df_mes[df_mes['Tipo'] == 'Gasto']
                base = alt.Chart(df_g).encode(theta=alt.Theta("Monto", stack=True))
                pie = base.mark_arc(outerRadius=100, innerRadius=50).encode(
                    color=alt.Color("Categoria", legend=alt.Legend(orient="bottom", columns=1)), 
                    order=alt.Order("Monto", sort="descending"),
                    tooltip=["Categoria", "Concepto", alt.Tooltip("Monto", format="$,.2f")]
                )
                st.altair_chart(pie, use_container_width=True)
            else:
                st.caption("Sin gastos este mes.")

        with c_sem:
            st.subheader("🚦 Semáforo")
            df_pres = cargar_datos(FILE_PRESUPUESTO, COLS_PRES)
            
            if not df_pres.empty and not df_mes.empty:
                g_cat = df_mes[df_mes['Tipo'] == 'Gasto'].groupby('Categoria')['Monto'].sum().reset_index()
                merged = pd.merge(df_pres, g_cat, on='Categoria', how='left').fillna(0)
                merged['Pct'] = merged['Monto'] / merged['Limite_Mensual']
                merged = merged.sort_values('Pct', ascending=False)
                
                with st.container(height=350):
                    for _, row in merged.iterrows():
                        cat = row['Categoria']
                        limite = row['Limite_Mensual']
                        real = row['Monto']
                        if limite > 0:
                            pct = min(real / limite, 1.0)
                            st.write(f"**{cat}**")
                            st.caption(f"${real:,.0f} de ${limite:,.0f}")
                            if (real/limite) > 1.0:
                                st.progress(1.0)
                                st.error(f"Excedido por ${real-limite:,.0f}")
                            elif (real/limite) > 0.8:
                                st.progress(pct) 
                            else:
                                st.progress(pct) 
                            st.write("")

# === TAB 2: PRESUPUESTO ===
with tab_pres:
    with st.form("budget_form"):
        c1, c2 = st.columns([2, 1])
        cat_new = c1.selectbox("Categoría", CATEGORIAS)
        lim_new = c2.number_input("Límite Mensual ($)", step=500.0)
        
        if st.form_submit_button("💾 Actualizar Límite", use_container_width=True):
            df_p = cargar_datos(FILE_PRESUPUESTO, COLS_PRES)
            if cat_new in df_p['Categoria'].values:
                df_p.loc[df_p['Categoria'] == cat_new, 'Limite_Mensual'] = lim_new
            else:
                nuevo = pd.DataFrame([{'Categoria': cat_new, 'Limite_Mensual': lim_new}])
                df_p = pd.concat([df_p, nuevo], ignore_index=True)
            guardar_datos(df_p, FILE_PRESUPUESTO)
            st.toast("✅ Meta actualizada", icon='🎯')
            st.rerun()

    st.dataframe(cargar_datos(FILE_PRESUPUESTO, COLS_PRES), use_container_width=True, column_config={"Limite_Mensual": st.column_config.NumberColumn(format="$%.2f")})

# === TAB 3: HISTORIAL ===
with tab_data:
    df_raw = cargar_datos(FILE_MOVS, COLS_MOVS)
    st.dataframe(df_raw.sort_values(by='Fecha', ascending=False), use_container_width=True, column_config={"Monto": st.column_config.NumberColumn(format="$%.2f"), "Fecha": st.column_config.DateColumn(format="DD/MM/YYYY")})
    
    if st.button("🗑️ Borrar último registro", type="primary"):
        if not df_raw.empty:
            df_raw = df_raw.iloc[:-1]
            guardar_datos(df_raw, FILE_MOVS)
            st.toast("Eliminado", icon='🗑️')
            st.rerun()