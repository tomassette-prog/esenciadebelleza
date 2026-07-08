#!/usr/bin/env python3
import os
import subprocess
import json

# Variables
PROJECT = "esenciadebelleza"
TEAM = "tomassette-progs-projects"
VAR_NAME = "SUPABASE_SERVICE_ROLE_KEY"
VAR_VALUE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqYW5vYnNmemN3cHVzeW52bHVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTY5NzE3OCwiZXhwIjoyMDk3MjczMTc4fQ.Ph7vXLcfU4Dv3YJ3jzcIOnehn9v_x0FvDMjtyDfkse8"

print(f"✅ Agregando {VAR_NAME} a Vercel Production")
print(f"   Proyecto: {PROJECT}")
print(f"   Team: {TEAM}")
print(f"   Valor: {VAR_VALUE[:30]}...")

cmd = [
    "powershell", "-NoProfile", "-Command",
    f"""
    $ErrorActionPreference = 'Stop'
    
    # Obtener el token
    $lines = @(Get-Content .env.local)
    $oidcToken = ($lines | Where-Object {{ $_ -match 'VERCEL_OIDC_TOKEN' }} | Select-Object -First 1).Split('=')[1].Trim('\"')
    
    if (-not $oidcToken) {{
        Write-Error "No VERCEL_OIDC_TOKEN found in .env.local"
        exit 1
    }}
    
    Write-Host "Token encontrado, intentando agregar variable..."
    
    # Usar curl para agregar la variable (simulando la solicitud)
    $payload = @{{
        key = '{VAR_NAME}'
        value = '{VAR_VALUE}'
        target = @('production')
    }} | ConvertTo-Json
    
    Write-Host "Payload: $payload"
    """
]

try:
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    if result.returncode != 0:
        print(f"Error (exit code {result.returncode})")
except Exception as e:
    print(f"Error ejecutando script: {e}")
