# Use Case: Raspberry Pi 400 Home Server

Running VibeSprint on a Raspberry Pi 400 as a dedicated issue-to-PR automation server.

## Why Raspberry Pi?

- **Always-on**: Low power (~5W), runs 24/7 for ~$5/year electricity
- **Local execution**: Code never leaves your network
- **Cost effective**: $100 one-time vs cloud compute costs
- **Privacy**: GitHub token stays on your hardware

## Setup

### Hardware
- Raspberry Pi 400 (4GB RAM)
- 32GB+ SD card or USB SSD
- Ethernet connection (recommended for stability)

### Software
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install kiro-cli
npm install -g @anthropic/kiro-cli

# Install VibeSprint
git clone https://github.com/amllamojha/vibesprint.git
cd vibesprint
npm install && npm run build && npm link
```

### Running as a Service

Create `/etc/systemd/system/vibesprint.service`:
```ini
[Unit]
Description=VibeSprint
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/my-project
Environment=GITHUB_TOKEN=github_pat_xxx
ExecStart=/usr/bin/vibesprint run --interval 60
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable vibesprint
sudo systemctl start vibesprint
```

## Performance

On Raspberry Pi 400:
- Polling overhead: negligible
- Memory usage: ~100MB
- kiro-cli execution: same as any machine (API-bound)

The Pi handles the orchestration; Kiro's cloud does the heavy lifting.

## My Setup

```
[GitHub Project Board]
        ↓ poll every 60s
[Raspberry Pi 400 @ home]
        ↓ invoke
[kiro-cli → Anthropic API]
        ↓ push
[GitHub PR created]
```

Issues go in, PRs come out — all from a $100 computer on my desk.
