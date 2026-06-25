"""Seed de productos: 5 productos en cada categoría (Jamones, Embutidos, Lotes).

Uso:
    cd /app/backend && python scripts/seed_products.py
    # o en Render shell:
    cd /opt/render/project/src/backend && python scripts/seed_products.py

NO duplica: si el SKU ya existe, lo salta.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv

# Permitir importar desde /backend y cargar .env
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from db import db


PRODUCTS = {
    "jamones": [
        dict(sku="JAM-BEL-50-5J",  name="Jamón de Bellota 100% Ibérico — 5J", price=620.00, compare_at_price=720.00,
             weight_grams=8500, stock=8, origin="Sierra de Aracena", curing_months=48, breed="100% Ibérico",
             feed="Bellota",
             description="Pieza emblemática curada durante 48 meses. Bouquet a frutos secos y monte bajo.",
             long_description="Jamón 100% Ibérico de bellota etiqueta negra (5 Jotas). Curado lento en cava natural durante un mínimo de 48 meses. Cerdo nacido y criado en libertad en dehesas extremeñas, alimentado a base de bellota y hierbas silvestres durante la última montanera. Veteado marfil, aroma intenso y final largo.",
             is_featured=True),
        dict(sku="JAM-BEL-75-4J",  name="Jamón de Bellota 75% Ibérico — 4J", price=380.00, compare_at_price=440.00,
             weight_grams=8000, stock=12, origin="Salamanca", curing_months=36, breed="75% Ibérico",
             feed="Bellota",
             description="36 meses de curación, sabor profundo y graso óptimo para corte fino.",
             long_description="Jamón ibérico de bellota etiqueta roja procedente de cerdos cruzados (75% raza ibérica). 36 meses de curación tradicional. Pieza con grasa infiltrada y aroma característico de la dehesa salmantina."),
        dict(sku="JAM-CEB-IBE",    name="Jamón de Cebo Ibérico", price=189.00, compare_at_price=220.00,
             weight_grams=7500, stock=20, origin="Castilblanco de los Arroyos", curing_months=24, breed="50% Ibérico",
             feed="Cebo",
             description="Equilibrio perfecto entre precio y calidad. 24 meses de cura.",
             long_description="Cerdo ibérico de cebo criado en granja con piensos seleccionados. Tras el sacrificio, salado artesanal y curación natural durante 24 meses en bodegas con microclima controlado."),
        dict(sku="JAM-BEL-100-RES",name="Jamón Reserva Familia — Edición Limitada", price=890.00, compare_at_price=999.00,
             weight_grams=9200, stock=3, origin="Jabugo", curing_months=60, breed="100% Ibérico puro",
             feed="Bellota pura",
             description="Edición limitada de la añada 2020. Sólo 50 piezas al año.",
             long_description="Pieza de coleccionista. Cerdo de raza ibérica pura criado en exclusiva en la dehesa familiar. Curación de 60 meses en bodegas centenarias. Cada jamón lleva número de serie y certificado de autenticidad firmado.",
             is_featured=True),
        dict(sku="JAM-DES-BEL-1KG",name="Jamón de Bellota Deshuesado — 1kg", price=92.00, compare_at_price=110.00,
             weight_grams=1000, stock=30, origin="Sierra Norte de Sevilla", curing_months=36, breed="75% Ibérico",
             feed="Bellota",
             description="Pieza deshuesada lista para fetear. Perfecta para regalo.",
             long_description="Jamón de bellota ibérico deshuesado por nuestros maestros cortadores y envasado al vacío en porciones de 1kg. Conservación 6 meses sin abrir."),
        dict(sku="JAM-PAL-BEL-5J", name="Paleta de Bellota 100% Ibérica — 5J", price=290.00, compare_at_price=330.00,
             weight_grams=5500, stock=10, origin="Jabugo", curing_months=30, breed="100% Ibérico", feed="Bellota",
             description="La hermana pequeña del 5J. Más dulce y untuosa.",
             long_description="Paleta delantera de cerdo 100% ibérico de bellota, curada 30 meses. Pieza ideal para regalo o consumo familiar — más manejable que un jamón entero."),
        dict(sku="JAM-PAL-IBE",    name="Paleta Ibérica de Cebo", price=125.00, compare_at_price=150.00,
             weight_grams=5000, stock=18, origin="Extremadura", curing_months=20, breed="50% Ibérico", feed="Cebo",
             description="20 meses de curación. Sabor equilibrado y precio accesible.",
             long_description="Paleta ibérica de cebo procedente de cerdos cruzados, curada de forma tradicional 20 meses en secadero natural."),
        dict(sku="JAM-PAL-DES-1KG",name="Paleta Deshuesada — 1kg", price=58.00, compare_at_price=72.00,
             weight_grams=1000, stock=25, origin="Sevilla", curing_months=24, breed="50% Ibérico", feed="Cebo",
             description="Pieza deshuesada al vacío. Comodidad total.",
             long_description="Paleta ibérica deshuesada, prensada y envasada al vacío. Lista para fetear sin esfuerzo."),
        dict(sku="JAM-CEN-BEL-500",name="Centro de Jamón de Bellota — 500g", price=48.00,
             weight_grams=500, stock=40, origin="Salamanca", curing_months=36, breed="75% Ibérico", feed="Bellota",
             description="La mejor parte del jamón, cortada al cuchillo.",
             long_description="Centro de la maza del jamón de bellota — la parte más jugosa y veteada. Cortado a cuchillo y envasado en sobres de 500g."),
        dict(sku="JAM-LON-BEL-100",name="Jamón de Bellota Loncheado — 100g", price=14.50,
             weight_grams=100, stock=120, origin="Huelva", curing_months=36, breed="75% Ibérico", feed="Bellota",
             description="Sobres individuales 100g. Calidad de cuchillo.",
             long_description="Lonchas finas cortadas a mano y envasadas inmediatamente en atmósfera protectora."),
    ],
    "embutidos": [
        dict(sku="EMB-CHO-BEL-200",name="Chorizo Ibérico de Bellota — 200g", price=14.50,
             weight_grams=200, stock=80, origin="Salamanca", breed="Ibérico bellota",
             description="Pimentón de la Vera y curado natural. Picante suave.",
             long_description="Chorizo elaborado con magro de cerdo ibérico de bellota, pimentón de la Vera (mezcla de dulce y picante), ajo y sal marina. Curación natural en secadero durante 8 semanas."),
        dict(sku="EMB-SAL-BEL-200",name="Salchichón Ibérico de Bellota — 200g", price=15.20,
             weight_grams=200, stock=70, origin="Extremadura", breed="Ibérico bellota",
             description="Aromatizado con pimienta negra molida en mortero.",
             long_description="Salchichón premium de magro ibérico de bellota. Especiado únicamente con pimienta negra, nuez moscada y sal. Sin colorantes ni conservantes añadidos."),
        dict(sku="EMB-LOM-BEL-300",name="Lomo Ibérico de Bellota — 300g", price=32.00,
             weight_grams=300, stock=45, origin="Guijuelo", breed="Ibérico bellota",
             description="Cinta de lomo curada en su justa medida. Untuosidad excepcional.",
             long_description="Caña de lomo entera procedente de cerdo ibérico de bellota. Marinada con pimentón, ajo y orégano, curada de forma natural durante 4 meses. Color cereza profundo y veta blanca de grasa intermuscular."),
        dict(sku="EMB-MOR-BEL-250",name="Morcón Ibérico — 250g", price=18.00,
             weight_grams=250, stock=35, origin="Huelva", breed="Ibérico",
             description="Pieza noble del ciego del cerdo. Sabor concentrado e intenso.",
             long_description="Morcón embutido en tripa natural de ciego, elaborado con la mejor pieza del ibérico de bellota. Adobo de pimentón, ajo y orégano. Curación lenta de 5 meses."),
        dict(sku="EMB-PAP-BEL-200",name="Papada de Ibérico — 200g", price=12.50,
             weight_grams=200, stock=60, origin="Sevilla", breed="Ibérico",
             description="Para tostas, mojos y aliños. Untuosa y aromática.",
             long_description="Papada curada de cerdo ibérico, ligeramente salada y curada al aire de la Sierra Norte."),
        dict(sku="EMB-CHO-SAR-300",name="Chorizo de Sarta — 300g", price=11.50,
             weight_grams=300, stock=55, origin="León", breed="Tradicional",
             description="Embutido tradicional curado en sarta. Para guisos o cortar.",
             long_description="Chorizo elaborado al estilo tradicional, atado en sarta y curado al aire de la sierra durante 6 semanas."),
        dict(sku="EMB-SAL-BLA-200",name="Salchichón Blanco Ibérico — 200g", price=13.80,
             weight_grams=200, stock=50, origin="Salamanca", breed="Ibérico",
             description="Sin pimentón, especiado con pimienta y orégano.",
             long_description="Salchichón sin pimentón, perfecto para apreciar el sabor puro del ibérico."),
        dict(sku="EMB-CAB-LOM-200",name="Cabecero de Lomo Ibérico — 200g", price=22.00,
             weight_grams=200, stock=40, origin="Huelva", breed="Ibérico bellota",
             description="La parte más jugosa del lomo, embuchada en tripa natural.",
             long_description="Cabecero de lomo (cabezada) de cerdo ibérico de bellota, embuchado en tripa natural y curado 3 meses."),
        dict(sku="EMB-CHO-PIC-200",name="Chorizo Picante Ibérico — 200g", price=15.00,
             weight_grams=200, stock=45, origin="Extremadura", breed="Ibérico",
             description="Pimentón picante de la Vera. Para los amantes del fuego.",
             long_description="Versión picante de nuestro chorizo ibérico estrella."),
        dict(sku="EMB-SUR-IBE-500",name="Surtido Ibéricos Variado — 500g", price=38.00, compare_at_price=45.00,
             weight_grams=500, stock=30, origin="Mix", breed="Ibérico",
             description="Surtido degustación: chorizo + salchichón + lomo + caña.",
             long_description="Bandeja surtida de 500g con porciones individuales de chorizo ibérico, salchichón, lomo y caña.",
             is_featured=True),
    ],
    "lotes": [
        dict(sku="LOT-DEG-CLA",    name="Lote Degustación Clásica", price=72.00, compare_at_price=85.00,
             weight_grams=1300, stock=40,
             description="200g jamón + 200g chorizo + 200g salchichón + 200g lomo + queso de oveja 500g.",
             long_description="Selección esencial de la casa: jamón ibérico de bellota, chorizo, salchichón y lomo (todo deshuesado y envasado al vacío) más un queso de oveja curado de la sierra. Caja regalo con cuchillo jamonero incluido.",
             is_featured=True),
        dict(sku="LOT-RES-NEG",    name="Lote Reserva Etiqueta Negra", price=210.00, compare_at_price=245.00,
             weight_grams=2200, stock=15,
             description="Pieza estrella: 500g jamón 5J + 250g lomo + 250g chorizo + 200g queso curado + AOVE.",
             long_description="Caja de regalo en madera con jamón de bellota 100% ibérico etiqueta negra (5J) en lonchas, lomo ibérico de bellota, chorizo y queso curado de oveja, además de una botella de AOVE picual de la cooperativa local.",
             is_featured=True),
        dict(sku="LOT-NAV-FAM",    name="Lote Navidad Familiar", price=325.00, compare_at_price=389.00,
             weight_grams=4500, stock=10,
             description="Para 6 personas. Jamón entero deshuesado + embutidos surtidos + dulces.",
             long_description="Pensado para celebraciones: jamón de bellota deshuesado en pieza completa, surtido de embutidos ibéricos, queso, AOVE, vino tinto crianza y dulces navideños artesanos."),
        dict(sku="LOT-COR-EMP",    name="Lote Corporativo — Empresa", price=145.00, compare_at_price=165.00,
             weight_grams=1800, stock=25,
             description="Regalo corporativo personalizable con tu logo en la caja.",
             long_description="Caja serigrafiada con su logotipo (mínimo 10 unidades). Contenido: jamón en lonchas 250g, chorizo, salchichón, lomo y queso curado. Acompañado de tarjeta personalizada."),
        dict(sku="LOT-DUO-LOV",    name="Lote Dúo de Enamorados", price=58.00, compare_at_price=68.00,
             weight_grams=900, stock=30,
             description="Cesta romántica: jamón, queso, AOVE y dulces para dos.",
             long_description="Una experiencia gastronómica completa pensada para regalar: 150g jamón de bellota, 200g queso de oveja curado, AOVE picual 250ml, mermelada artesana y tabla de madera para servir."),
        dict(sku="LOT-CAT-PRO",    name="Lote Cata Profesional", price=185.00, compare_at_price=220.00,
             weight_grams=1500, stock=12,
             description="3 jamones diferentes (cebo, 4J, 5J) para cata comparada.",
             long_description="Pensado para sumilleres y aficionados: tres muestras de 200g cada una (jamón de cebo, 4J y 5J) con ficha de cata, manual del experto y guía de maridaje con vinos andaluces."),
        dict(sku="LOT-MIN-REG",    name="Mini Lote de Regalo", price=32.00, compare_at_price=40.00,
             weight_grams=500, stock=50,
             description="Lote ligero ideal para detalle: chorizo + salchichón + queso.",
             long_description="El detalle perfecto para un cumpleaños o agradecimiento: chorizo y salchichón ibérico, queso de oveja curado y palitos de pan rústicos. En caja regalo."),
        dict(sku="LOT-GOU-PRE",    name="Lote Gourmet Premium", price=275.00, compare_at_price=320.00,
             weight_grams=3200, stock=8,
             description="Selección premium con pieza entera de bellota 4J + foie + caviar.",
             long_description="La experiencia más exclusiva: paleta de bellota 4J entera, foie mi-cuit artesano de Soria, caviar de trucha del Pirineo, queso azul curado y AOVE Premium en caja madera lacada.",
             is_featured=True),
        dict(sku="LOT-SAL-HEA",    name="Lote Saludable Mediterráneo", price=68.00,
             weight_grams=1100, stock=20,
             description="Bajo en sal: jamón cebo + AOVE + miel + frutos secos + paté olivas.",
             long_description="Lote pensado para regalar bienestar: jamón de cebo bajo en sal, AOVE picual ecológico, miel de la sierra, almendras crudas, mermelada sin azúcar añadida y paté de aceitunas verdes andaluzas."),
        dict(sku="LOT-XL-EMP",     name="Lote XL Empresa — 10 personas", price=420.00, compare_at_price=495.00,
             weight_grams=6000, stock=6,
             description="Para celebraciones de empresa, 10-12 personas.",
             long_description="Pieza grande para eventos: jamón de bellota entero 5J + tablas de embutidos surtidos (1.5kg) + tabla de quesos (1kg) + botella de tinto crianza + cuchillo jamonero profesional."),
    ],
    "quesos": [
        dict(sku="QUE-OVE-CUR-500", name="Queso de Oveja Curado — 500g", price=18.50, compare_at_price=22.00,
             weight_grams=500, stock=40, origin="Sierra Norte de Sevilla", curing_months=8,
             description="Curado en cueva natural durante 8 meses. Sabor intenso y picante.",
             long_description="Queso elaborado con leche cruda de oveja merina, cuajado natural y curado en bodega de la sierra durante 8 meses. Textura firme con cristales de tirosina y aroma penetrante a hierba seca.",
             is_featured=True),
        dict(sku="QUE-OVE-SEM-500", name="Queso de Oveja Semicurado — 500g", price=14.20,
             weight_grams=500, stock=55, origin="Castilblanco de los Arroyos", curing_months=4,
             description="Equilibrio perfecto entre cremosidad y carácter. 4 meses de cura.",
             long_description="Queso de oveja semicurado, cremoso y de sabor suave. Perfecto para tablas y bocadillos."),
        dict(sku="QUE-CAB-EME-400", name="Queso de Cabra al Romero — 400g", price=16.80,
             weight_grams=400, stock=30, origin="Sierra Morena", curing_months=3,
             description="Cubierto en romero fresco de la sierra. Aroma único.",
             long_description="Queso artesanal de cabra payoya, recubierto con romero silvestre y curado 3 meses. Pasta blanca y delicada con notas herbales."),
        dict(sku="QUE-AZU-CAB-300", name="Queso Azul de Cabra — 300g", price=22.00,
             weight_grams=300, stock=22, origin="Picos de Europa", curing_months=5,
             description="Cremoso y picante. Para los amantes del azul.",
             long_description="Queso azul elaborado con leche cruda de cabra y madurado en cueva natural durante 5 meses. Vetas azul intenso y final largo y persistente."),
        dict(sku="QUE-PAY-VIE-1KG", name="Payoyo Viejo — 1kg", price=46.00, compare_at_price=55.00,
             weight_grams=1000, stock=12, origin="Villaluenga del Rosario (Cádiz)", curing_months=12,
             description="Pieza grande de payoyo añejo. Premiado en World Cheese Awards.",
             long_description="Queso payoyo elaborado con leche cruda de oveja merina grazalemeña y curado 12 meses en cueva natural. Galardonado con tres estrellas en los World Cheese Awards 2023.",
             is_featured=True),
        dict(sku="QUE-TOR-FRE-250", name="Torta del Casar — 250g", price=15.50,
             weight_grams=250, stock=28, origin="Cáceres",
             description="Cremosa, se come a cuchara. Pura tradición extremeña.",
             long_description="Torta del Casar con Denominación de Origen. Pasta blanda y cremosa que se sirve abriendo la corteza por arriba."),
    ],
    "vinos": [
        dict(sku="VIN-TIN-CRI-75", name="Tinto Crianza Sierra Norte — 75cl", price=14.50,
             weight_grams=1300, stock=60, origin="Sierra Norte de Sevilla",
             description="Crianza 12 meses en barrica francesa. Tempranillo + Syrah.",
             long_description="Vino tinto crianza elaborado con uvas tempranillo y syrah de las pequeñas viñas de la sierra. Crianza de 12 meses en barricas de roble francés. Color rojo cereza y aromas a fruta madura, vainilla y especias.",
             is_featured=True),
        dict(sku="VIN-BLA-VER-75", name="Blanco Verdejo Castilblanco — 75cl", price=11.80,
             weight_grams=1300, stock=50, origin="Sevilla",
             description="Verdejo joven y aromático. Marida con jamón ibérico.",
             long_description="Vino blanco verdejo elaborado en pequeñas tinajas de barro. Aromas a hierba fresca, manzana verde y notas cítricas. Perfecto para acompañar jamón y embutidos ibéricos."),
        dict(sku="VIN-FIN-MAN-75", name="Fino Andaluz — 75cl", price=13.00,
             weight_grams=1300, stock=40, origin="Jerez de la Frontera",
             description="Crianza biológica bajo velo de flor. Maridaje rey con ibéricos.",
             long_description="Vino generoso fino elaborado bajo velo de flor en bodegas centenarias. Notas almendradas y salinas. Servir frío para acompañar jamón ibérico y embutidos."),
        dict(sku="VIN-RES-FAM-75", name="Reserva Familiar Doncellas — 75cl", price=28.00, compare_at_price=34.00,
             weight_grams=1400, stock=18, origin="Sierra Norte de Sevilla",
             description="Reserva 24 meses. Edición limitada de nuestra bodega.",
             long_description="Vino reserva exclusivo de la casa: tempranillo y graciano de viñas viejas, crianza de 24 meses en barrica francesa y americana, y 12 meses adicionales en botella.",
             is_featured=True),
        dict(sku="VIN-DUL-PED-50", name="Pedro Ximénez Dulce — 50cl", price=18.50,
             weight_grams=900, stock=25, origin="Montilla-Moriles",
             description="Vino dulce natural envejecido en solera de 20 años.",
             long_description="Pedro Ximénez de pasas, dulce natural envejecido en solera durante 20 años. Notas a higos, dátil, café y cacao. Ideal con quesos azules y postres."),
        dict(sku="VIN-CAV-BRU-75", name="Cava Brut Nature — 75cl", price=12.80,
             weight_grams=1400, stock=42, origin="Penedès",
             description="Burbuja fina y elegante. Sin azúcar añadido.",
             long_description="Cava elaborado con macabeo, xarello y parellada. Crianza mínima de 15 meses en rima. Sin azúcar añadido."),
    ],
    "aceites": [
        dict(sku="ACE-PIC-COO-500", name="AOVE Picual Cooperativa — 500ml", price=12.50,
             weight_grams=600, stock=80, origin="Castilblanco de los Arroyos",
             description="Aceite virgen extra picual de primera presión en frío.",
             long_description="Aceite de oliva virgen extra variedad picual, recolección temprana y primera presión en frío. Aroma a tomatera y hoja verde, sabor frutado intenso con final ligeramente amargo.",
             is_featured=True),
        dict(sku="ACE-HOJ-PRE-500", name="AOVE Hojiblanca Premium — 500ml", price=14.00,
             weight_grams=600, stock=60, origin="Estepa (Sevilla)",
             description="Hojiblanca temprana. Suave y aromático.",
             long_description="Aceite de oliva virgen extra hojiblanca recolectado en verde. Notas a almendra dulce y manzana. Ideal para crudo y pescado."),
        dict(sku="ACE-COU-PIC-250", name="AOVE Coupage Picual & Arbequina — 250ml", price=8.80,
             weight_grams=350, stock=70, origin="Andalucía",
             description="Mezcla equilibrada para uso diario.",
             long_description="Coupage de picual y arbequina, lo mejor de cada variedad: el carácter del picual y la suavidad del arbequina. Botella de 250ml ideal para regalo."),
        dict(sku="ACE-TRU-BLA-100", name="Aceite Trufado Blanco — 100ml", price=18.50,
             weight_grams=180, stock=30, origin="Italia + Andalucía",
             description="AOVE aromatizado con trufa blanca natural.",
             long_description="Aceite virgen extra aromatizado con trufa blanca natural. Pocas gotas transforman cualquier plato. Perfecto para risottos, huevos y carpaccios."),
        dict(sku="ACE-VIN-RES-250", name="Vinagre de Jerez Reserva — 250ml", price=9.50,
             weight_grams=400, stock=55, origin="Jerez de la Frontera",
             description="Vinagre de Jerez con DO. Crianza mínima 2 años.",
             long_description="Vinagre de Jerez con Denominación de Origen. Solera mínima de 2 años en barricas de roble americano. Notas a manzana asada, frutos secos y madera."),
        dict(sku="ACE-MIE-SIE-450", name="Miel de la Sierra — 450g", price=11.50,
             weight_grams=520, stock=45, origin="Sierra Norte de Sevilla",
             description="Miel multifloral cruda, sin filtrar.",
             long_description="Miel multifloral artesana recogida en colmenas de la Sierra Norte. Sin pasteurizar, sin filtrar — conserva todas sus enzimas y propiedades. Aroma intenso a flores silvestres."),
    ],
}


# Imagen por defecto para cada categoría (Unsplash). Cuando el cliente sube
# las suyas se reemplazan, pero así el demo nunca queda con tarjetas vacías.
DEFAULT_IMAGES = {
    "jamones":   "https://images.unsplash.com/photo-1732565432358-a8c95bc24ea3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "embutidos": "https://images.unsplash.com/photo-1695606392727-d8b959879721?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "quesos":    "https://images.unsplash.com/photo-1452195100486-9cc805987862?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "vinos":     "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "aceites":   "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "lotes":     "https://images.unsplash.com/photo-1656423739016-5de747b2c4fb?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
}


async def _ensure_categories() -> dict:
    """Crea las categorías base si no existen. Devuelve {slug: id}."""
    CATS = [
        {"slug": "jamones", "name": "Jamones", "position": 1},
        {"slug": "embutidos", "name": "Embutidos", "position": 2},
        {"slug": "quesos", "name": "Quesos", "position": 3},
        {"slug": "vinos", "name": "Vinos & Generosos", "position": 4},
        {"slug": "aceites", "name": "Aceites & Conservas", "position": 5},
        {"slug": "lotes", "name": "Lotes Selectos", "position": 6},
    ]
    result = {}
    for c in CATS:
        existing = await db.categories.find_one({"slug": c["slug"]})
        if existing:
            result[c["slug"]] = existing["id"]
            continue
        cat_id = str(uuid.uuid4())
        await db.categories.insert_one({
            "id": cat_id,
            "slug": c["slug"],
            "name": c["name"],
            "position": c["position"],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        result[c["slug"]] = cat_id
        print(f"  + categoría creada: {c['slug']}")
    return result


async def seed():
    cats = await _ensure_categories()
    print(f"Categorías listas: {list(cats.keys())}")

    inserted = skipped = 0
    for slug, items in PRODUCTS.items():
        cat_id = cats[slug]
        for raw in items:
            if await db.products.find_one({"sku": raw["sku"]}):
                skipped += 1
                continue
            now = datetime.now(timezone.utc).isoformat()
            doc = {
                "id": str(uuid.uuid4()),
                "name": raw["name"],
                "sku": raw["sku"],
                "description": raw.get("description", ""),
                "long_description": raw.get("long_description", ""),
                "price": float(raw["price"]),
                "compare_at_price": raw.get("compare_at_price"),
                "vat_rate": 10,
                "category_id": cat_id,
                "provider_id": None,
                "tags": ["ibérico"] if slug in ("jamones", "embutidos") else (
                    ["queso", "artesano"] if slug == "quesos" else (
                    ["vino"] if slug == "vinos" else (
                    ["aceite", "conserva"] if slug == "aceites" else
                    ["lote", "regalo"]))),
                "stock": int(raw.get("stock", 10)),
                "low_stock_threshold": 5,
                "weight_grams": raw.get("weight_grams"),
                "origin": raw.get("origin"),
                "curing_months": raw.get("curing_months"),
                "breed": raw.get("breed"),
                "feed": raw.get("feed"),
                "images": [DEFAULT_IMAGES.get(slug)] if DEFAULT_IMAGES.get(slug) else [],
                "is_featured": raw.get("is_featured", False),
                "is_active": True,
                "avg_rating": 0.0,
                "review_count": 0,
                "created_at": now,
                "updated_at": now,
            }
            await db.products.insert_one(doc)
            inserted += 1
            print(f"  ✓ {raw['sku']:<18} {raw['name']}")

    print(f"\nResultado: {inserted} insertados · {skipped} ya existían (saltados).")


if __name__ == "__main__":
    asyncio.run(seed())
