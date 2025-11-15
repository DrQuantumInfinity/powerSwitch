const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// GPIO setup - only import onoff on Raspberry Pi
let Gpio;
let gpios = {};
const GPIO_PINS = [19, 6, 5, 22, 27, 17, 4];

// GPIO labels storage
const LABELS_FILE = path.join(__dirname, 'gpio-labels.json');
let gpioLabels = {};

// Initialize default labels
GPIO_PINS.forEach(pin => {
    gpioLabels[pin] = `GPIO ${pin}`;
});

// Load labels from file if exists
if (fs.existsSync(LABELS_FILE)) {
    try {
        const savedLabels = JSON.parse(fs.readFileSync(LABELS_FILE, 'utf8'));
        gpioLabels = {...gpioLabels, ...savedLabels};
        console.log('GPIO labels loaded from file');
    } catch (err) {
        console.error('Error loading labels:', err.message);
    }
}

// Function to save labels to file
function saveLabels() {
    try {
        fs.writeFileSync(LABELS_FILE, JSON.stringify(gpioLabels, null, 2));
        console.log('GPIO labels saved to file');
    } catch (err) {
        console.error('Error saving labels:', err.message);
    }
}

// Check if running on Raspberry Pi
const isRaspberryPi = process.platform === 'linux' && (process.arch === 'arm' || process.arch === 'arm64');

if (isRaspberryPi) {
    try {
        Gpio = require('onoff').Gpio;

        // Initialize GPIO pins
        GPIO_PINS.forEach(pin => {
            try {
                gpios[pin] = new Gpio(pin, 'out');
                gpios[pin].writeSync(0); // Initialize to LOW
                console.log(`GPIO ${pin} initialized`);
            } catch (err) {
                console.error(`Error initializing GPIO ${pin}:`, err.message);
            }
        });
    } catch (err) {
        console.error('Error loading onoff module:', err.message);
        console.log('Running in simulation mode');
    }
} else {
    console.log('Not running on Raspberry Pi - simulation mode enabled');
}

// Store GPIO states for simulation mode
const gpioStates = {};
GPIO_PINS.forEach(pin => {
    gpioStates[pin] = 0;
});

// API endpoint to set GPIO state
app.post('/gpio/:pin/:state', (req, res) => {
    const pin = parseInt(req.params.pin);
    const state = parseInt(req.params.state);

    // Validate pin number
    if (!GPIO_PINS.includes(pin)) {
        return res.status(400).json({
            error: 'Invalid GPIO pin',
            validPins: GPIO_PINS
        });
    }

    // Validate state (0 or 1)
    if (state !== 0 && state !== 1) {
        return res.status(400).json({
            error: 'Invalid state. Use 0 (LOW) or 1 (HIGH)'
        });
    }

    try {
        if (gpios[pin]) {
            // Real GPIO control
            gpios[pin].writeSync(state);
            console.log(`GPIO ${pin} set to ${state ? 'HIGH' : 'LOW'}`);
        } else {
            // Simulation mode
            gpioStates[pin] = state;
            console.log(`[SIMULATION] GPIO ${pin} set to ${state ? 'HIGH' : 'LOW'}`);
        }

        res.json({
            success: true,
            pin: pin,
            state: state,
            mode: gpios[pin] ? 'hardware' : 'simulation'
        });
    } catch (err) {
        console.error(`Error setting GPIO ${pin}:`, err.message);
        res.status(500).json({
            error: 'Failed to set GPIO state',
            details: err.message
        });
    }
});

// API endpoint to get GPIO state
app.get('/gpio/:pin', (req, res) => {
    const pin = parseInt(req.params.pin);

    if (!GPIO_PINS.includes(pin)) {
        return res.status(400).json({
            error: 'Invalid GPIO pin',
            validPins: GPIO_PINS
        });
    }

    try {
        let state;
        if (gpios[pin]) {
            state = gpios[pin].readSync();
        } else {
            state = gpioStates[pin];
        }

        res.json({
            pin: pin,
            state: state,
            mode: gpios[pin] ? 'hardware' : 'simulation'
        });
    } catch (err) {
        console.error(`Error reading GPIO ${pin}:`, err.message);
        res.status(500).json({
            error: 'Failed to read GPIO state',
            details: err.message
        });
    }
});

// API endpoint to get all GPIO states
app.get('/gpio', (req, res) => {
    const states = {};

    GPIO_PINS.forEach(pin => {
        try {
            if (gpios[pin]) {
                states[pin] = gpios[pin].readSync();
            } else {
                states[pin] = gpioStates[pin];
            }
        } catch (err) {
            states[pin] = null;
        }
    });

    res.json({
        states: states,
        mode: Object.keys(gpios).length > 0 ? 'hardware' : 'simulation'
    });
});

// API endpoint to get all GPIO labels
app.get('/labels', (req, res) => {
    res.json({
        labels: gpioLabels
    });
});

// API endpoint to update a GPIO label
app.post('/labels/:pin', (req, res) => {
    const pin = parseInt(req.params.pin);
    const {label} = req.body;

    // Validate pin number
    if (!GPIO_PINS.includes(pin)) {
        return res.status(400).json({
            error: 'Invalid GPIO pin',
            validPins: GPIO_PINS
        });
    }

    // Validate label
    if (!label || typeof label !== 'string') {
        return res.status(400).json({
            error: 'Invalid label. Must be a non-empty string'
        });
    }

    // Trim and limit label length
    const trimmedLabel = label.trim().substring(0, 50);

    if (trimmedLabel.length === 0) {
        return res.status(400).json({
            error: 'Label cannot be empty'
        });
    }

    // Update label
    gpioLabels[pin] = trimmedLabel;
    saveLabels();

    res.json({
        success: true,
        pin: pin,
        label: trimmedLabel
    });
});

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('\nCleaning up GPIO...');
    Object.keys(gpios).forEach(pin => {
        try {
            gpios[pin].writeSync(0);
            gpios[pin].unexport();
        } catch (err) {
            console.error(`Error cleaning up GPIO ${pin}:`, err.message);
        }
    });
    process.exit();
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`GPIO Controller running on http://0.0.0.0:${PORT}`);
    console.log(`Mode: ${Object.keys(gpios).length > 0 ? 'Hardware' : 'Simulation'}`);
    console.log(`Controlling GPIO pins: ${GPIO_PINS.join(', ')}`);
});
