# Coastal.AI on Windows

One-line installer for Windows users.

## Prerequisites

Before installing, ensure you have:

1. **Git** — [Download](https://git-scm.com)
2. **Node.js 22 LTS** — [Download](https://nodejs.org)
3. **Ollama** — [Download](https://ollama.com)

All three are required. The installer will check for them and fail clearly if anything is missing.

## Installation (One-Line Command)

Open **PowerShell** (not cmd) and run:

```powershell
iex (irm https://raw.githubusercontent.com/CoastalCrypto/Coastal.AI/master/install-windows.ps1)
```

That's it. The installer will:
- Clone the repository to `C:\Users\{YourUsername}\coastal-ai`
- Install all dependencies
- Build the project
- Pull the default AI model (llama3.2, ~2 GB)
- Open the web interface in your browser

## Starting Services

Once installed, open **PowerShell** and run:

```powershell
& "$env:USERPROFILE\AppData\Local\coastal-ai\coastal-ai.ps1" start
```

Or simpler, create a shortcut with this command and run it whenever you want to start Coastal.AI.

## Service Commands

```powershell
# Start services (opens web UI automatically)
.\coastal-ai.ps1 start

# Stop all services
.\coastal-ai.ps1 stop

# Check if services are running
.\coastal-ai.ps1 status

# Restart services
.\coastal-ai.ps1 restart

# View recent logs
.\coastal-ai.ps1 logs
```

## Access Coastal.AI

Once running, open your browser:

- **Web UI**: http://127.0.0.1:5173
- **API**: http://127.0.0.1:4747

Default login:
- Username: `admin`
- Password: `admin`

You'll be prompted to set a new password on first login.

## Updating

To update to the latest version:

```powershell
cd $env:USERPROFILE\coastal-ai
git pull origin master
pnpm install
pnpm build
```

Then restart services.

## Uninstalling

Simply delete the installation directory:

```powershell
Remove-Item -Recurse -Force $env:USERPROFILE\coastal-ai
Remove-Item -Recurse -Force $env:USERPROFILE\AppData\Local\coastal-ai
```

## Troubleshooting

### "PowerShell scripts are disabled on this system"

If you get an execution policy error, try running PowerShell as Administrator and then:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "Git is not found"

Install Git from https://git-scm.com, then restart PowerShell.

### "Node.js version must be 22+"

Install Node.js 22 LTS from https://nodejs.org, then restart PowerShell.

### "Ollama not found"

Install Ollama from https://ollama.com, then restart PowerShell.

### Services won't start

Check the logs:

```powershell
.\coastal-ai.ps1 logs
```

Logs are stored in `$env:TEMP\coastal-ai\`.

### Port already in use

If port 4747 or 5173 is already in use:

```powershell
# Find what's using port 4747
netstat -ano | findstr :4747

# Kill the process (replace PID with the process ID shown above)
taskkill /PID {PID} /F
```

Then restart Coastal.AI.

## Need Help?

- **Repository**: https://github.com/CoastalCrypto/Coastal.AI
- **Issues**: https://github.com/CoastalCrypto/Coastal.AI/issues
