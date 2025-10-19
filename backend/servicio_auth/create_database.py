import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

# Set default encoding to UTF-8
if sys.platform == 'win32':
    import locale
    locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')

# Load environment variables
load_dotenv()

# Get database credentials
db_user = os.getenv('DATABASE_USER', 'postgres')
db_password = os.getenv('DATABASE_PASSWORD', 'postgres')
db_host = os.getenv('DATABASE_SERVER', 'localhost')
db_port = os.getenv('DATABASE_PORT', '5432')
db_name = os.getenv('DATABASE_DB', 'auth_db')

print(f"Intentando conectar a PostgreSQL en {db_host}:{db_port}")
print(f"Usuario: {db_user}")
print(f"Base de datos a crear: {db_name}")

try:
    # Connect to PostgreSQL server (to 'postgres' database)
    conn = psycopg2.connect(
        dbname='postgres',
        user=db_user,
        password=db_password,
        host=db_host,
        port=db_port,
        options='-c client_encoding=UTF8'
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    
    # Check if database exists
    cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'")
    exists = cursor.fetchone()
    
    if exists:
        print(f"✅ La base de datos '{db_name}' ya existe.")
    else:
        # Create database with UTF-8 encoding
        cursor.execute(
            f"CREATE DATABASE {db_name} "
            f"WITH ENCODING='UTF8' "
            f"LC_COLLATE='C' "
            f"LC_CTYPE='C' "
            f"TEMPLATE=template0;"
        )
        print(f"✅ Base de datos '{db_name}' creada exitosamente con encoding UTF-8!")
    
    cursor.close()
    conn.close()
    
except psycopg2.OperationalError as e:
    print(f"❌ Error de conexión a PostgreSQL:")
    print(f"   {str(e)}")
    print("\nPor favor verifica:")
    print("1. PostgreSQL está corriendo")
    print("2. Las credenciales en el archivo .env son correctas")
    print("3. El usuario tiene permisos para crear bases de datos")
except Exception as e:
    print(f"❌ Error inesperado: {str(e)}")
