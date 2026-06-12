"""Centralized company info for invoices, emails and templates."""
import os


def get_company():
    return {
        "name": os.environ.get("COMPANY_NAME", "Las Dos Doncellas"),
        "legal_name": os.environ.get("COMPANY_LEGAL_NAME", "Las Dos Doncellas S.L."),
        "cif": os.environ.get("COMPANY_CIF", "77815813M"),
        "address": os.environ.get("COMPANY_ADDRESS", "Calle Huerto del Cura, 2"),
        "postal": os.environ.get("COMPANY_POSTAL", "41230"),
        "city": os.environ.get("COMPANY_CITY", "Castilblanco de los Arroyos"),
        "province": os.environ.get("COMPANY_PROVINCE", "Sevilla"),
        "country": os.environ.get("COMPANY_COUNTRY", "España"),
        "region": os.environ.get("COMPANY_REGION", "Sierra Norte de Sevilla"),
        "email": os.environ.get("COMPANY_EMAIL", "pedidos@lasdosdoncellasibericos.es"),
    }
