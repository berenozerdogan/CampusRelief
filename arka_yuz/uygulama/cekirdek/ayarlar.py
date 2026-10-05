from pydantic_settings import BaseSettings

class Ayarlar(BaseSettings):
    PROJE_ADI: str = "KampüsDestek"
    API_V1_STR: str = "/api/v1"
    
    GIZLI_ANAHTAR: str = "SUPER_GIZLI_KAMPUS_DESTEK_JWT_SALT_2026"
    ALGORITMA: str = "HS256"
    ERISIM_TOKEN_SURESI_DAKIKA: int = 60 * 24
    
    POSTGRES_KULLANICI: str = "kampus_admin"
    POSTGRES_SIFRE: str = "guclu_kampus_sifresi_2026"
    POSTGRES_SUNUCU: str = "localhost"
    POSTGRES_PORT: str = "5433"
    POSTGRES_DB: str = "kampusdestek_db"
    
    @property
    def VERITABANI_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_KULLANICI}:{self.POSTGRES_SIFRE}@{self.POSTGRES_SUNUCU}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    REDIS_URL: str = "redis://localhost:6380/0"

    class Config:
        case_sensitive = True

ayarlar = Ayarlar()
