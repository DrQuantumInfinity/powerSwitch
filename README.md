# Raspberry Pi GPIO Controller

A simple web application to control 8 GPIO pins on a Raspberry Pi through a web interface.

## Features

- Web-based interface with 8 GPIO control panels
- ON/OFF buttons for each GPIO pin
- Real-time status display
- Responsive design for mobile and desktop
- Simulation mode for development on non-Raspberry Pi systems

## GPIO Pins Controlled

The application controls the following GPIO pins:
- GPIO 17
- GPIO 18
- GPIO 22
- GPIO 23
- GPIO 24
- GPIO 25
- GPIO 27
- GPIO 4

## Installation

### Quick Deployment to Raspberry Pi

The easiest way to deploy is using the included deployment script:

1. Make sure your Raspberry Pi has Node.js installed (see manual installation below if needed)

2. Run the deployment script from your development machine:
```bash
PI_HOST=192.168.1.100 ./deploy.sh
```

Replace `192.168.1.100` with your Raspberry Pi's IP address or hostname (e.g., `raspberrypi.local`).

Optional environment variables:
- `PI_USER=<username>` - SSH username (default: pi)
- `PI_DIR=<target-dir>` - Target directory (default: /home/pi/powerSwitch)
- `PI_PORT=<ssh-port>` - SSH port (default: 22)

Example with custom settings:
```bash
PI_HOST=raspberrypi.local PI_USER=paul PI_DIR=/opt/powerSwitch ./deploy.sh
```

The script will:
- Copy all necessary files to your Raspberry Pi
- Install dependencies automatically
- Optionally start the application

### Manual Installation on Raspberry Pi

1. Install Node.js (if not already installed):
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. Clone or copy this project to your Raspberry Pi

3. Install dependencies:
```bash
npm install
```

### On Development Machine (Simulation Mode)

The app will run in simulation mode on non-ARM Linux systems or non-Linux platforms. Simply install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

Or with sudo (required for GPIO access on some systems):
```bash
sudo npm start
```

2. Open a web browser and navigate to:
```
http://<raspberry-pi-ip>:3000
```

Or if running locally:
```
http://localhost:3000
```

3. Use the ON/OFF buttons to control each GPIO pin

## API Endpoints

The server provides REST API endpoints:

### Set GPIO State
```
POST /gpio/:pin/:state
```
- `pin`: GPIO pin number (17, 18, 22, 23, 24, 25, 27, 4)
- `state`: 0 (LOW) or 1 (HIGH)

### Get GPIO State
```
GET /gpio/:pin
```

### Get All GPIO States
```
GET /gpio
```

## Hardware Connections

Connect your devices to the GPIO pins with appropriate resistors and components. Make sure to:

1. Use proper current limiting resistors for LEDs
2. Check voltage compatibility of connected devices
3. Never connect high-current devices directly to GPIO pins
4. Consider using relay modules for controlling high-power devices

## Safety Notes

- GPIO pins output 3.3V (not 5V)
- Maximum current per pin: 16mA
- Total current from all pins: 50mA
- Always use appropriate protection circuits
- Double-check wiring before powering on

## Troubleshooting

### Permission Denied Error
If you get permission errors accessing GPIO, run with sudo:
```bash
sudo npm start
```

### Port Already in Use
If port 3000 is already in use, you can change it in [server.js:5](server.js#L5)

### GPIO Not Working
1. Ensure you're running on a Raspberry Pi
2. Check that GPIO pins are not being used by other processes
3. Verify wiring connections
4. Check system logs for errors

## License

MIT
