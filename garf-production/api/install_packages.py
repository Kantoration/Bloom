#!/usr/bin/env python3
"""
Manual package installer for GARF API dependencies
This script helps install packages when pip is having issues
"""

import subprocess
import sys
import os

def install_package(package):
    """Install a package using subprocess"""
    try:
        print(f"Installing {package}...")
        result = subprocess.run([
            sys.executable, '-m', 'pip', 'install', package
        ], capture_output=True, text=True, check=True)
        print(f"✅ {package} installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install {package}: {e}")
        print(f"Error output: {e.stderr}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error installing {package}: {e}")
        return False

def main():
    """Install all required packages"""
    print("🚀 Installing GARF API Dependencies")
    print("=" * 50)
    
    # Core FastAPI packages
    packages = [
        "fastapi==0.104.1",
        "uvicorn[standard]==0.24.0",
        "pydantic[email]==2.5.0",
        "pydantic-settings==2.1.0",
        "python-multipart==0.0.6",
        "email-validator==2.1.0",
    ]
    
    # Database packages
    db_packages = [
        "sqlalchemy==2.0.23",
        "psycopg2-binary==2.9.9",
        "alembic==1.12.1",
    ]
    
    # Redis packages
    redis_packages = [
        "redis==5.0.1",
        "rq==1.15.1",
    ]
    
    # Data processing packages
    data_packages = [
        "pandas==2.1.3",
        "numpy==1.24.4",
        "scipy==1.11.4",
    ]
    
    # Security packages
    security_packages = [
        "python-jose[cryptography]==3.3.0",
        "passlib[bcrypt]==1.7.4",
        "python-dotenv==1.0.0",
    ]
    
    # Email packages (already installed)
    email_packages = [
        "fastapi-mail==1.4.1",
        "jinja2==3.1.2",
    ]
    
    # Monitoring packages
    monitoring_packages = [
        "sentry-sdk==1.38.0",
        "prometheus-client==0.19.0",
    ]
    
    # Testing packages
    testing_packages = [
        "pytest==7.4.3",
        "pytest-asyncio==0.21.1",
        "httpx==0.25.2",
    ]
    
    # Development packages
    dev_packages = [
        "black==23.11.0",
        "flake8==6.1.0",
        "mypy==1.7.0",
    ]
    
    all_packages = (
        packages + db_packages + redis_packages + 
        data_packages + security_packages + 
        monitoring_packages + testing_packages + dev_packages
    )
    
    successful_installs = 0
    failed_installs = 0
    
    for package in all_packages:
        if install_package(package):
            successful_installs += 1
        else:
            failed_installs += 1
        print()  # Add spacing
    
    print("=" * 50)
    print(f"📊 Installation Summary:")
    print(f"✅ Successful: {successful_installs}")
    print(f"❌ Failed: {failed_installs}")
    print(f"📦 Total: {len(all_packages)}")
    
    if failed_installs == 0:
        print("\n🎉 All packages installed successfully!")
        print("\nNext steps:")
        print("1. Run the database migration")
        print("2. Configure email settings in .env")
        print("3. Test the system with: py test_email_verification.py")
    else:
        print(f"\n⚠️  {failed_installs} packages failed to install")
        print("You may need to install them manually or check your Python environment")

if __name__ == "__main__":
    main()
