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
let buttons = {};
const GPIO_PINS = [19, 13, 6, 5, 22, 27, 17, 4];
const BUTTON_PINS = [21, 20, 16, 12, 25, 24, 23, 18]; // Button GPIOs for each relay
// const GPIO_PINS = [7, 11, 13 , 15 , 29, 31, 33, 35];

// GPIO labels storage
const LABELS_FILE = path.join(__dirname, 'gpio-labels.json');
let gpioLabels = {};

// Initialize default labels (using indices 0-7)
GPIO_PINS.forEach((pin, index) => {
    gpioLabels[index] = `Relay ${index}`;
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
const isRaspberryPi = process.platform === 'linux' && (process.arch === 'arm' || process.arch === 'arm64' || process.arch.startsWith('arm'));

// Function to toggle relay state
function toggleRelay(index) {
    const pin = GPIO_PINS[index];
    try {
        let currentState;
        if (gpios[index]) {
            currentState = gpios[index].readSync();
            const newState = currentState === 0 ? 1 : 0;
            gpios[index].writeSync(newState);
            console.log(`Button press: Relay ${index} (GPIO ${pin}) toggled to ${newState ? 'HIGH' : 'LOW'}`);
        } else {
            currentState = gpioStates[index];
            const newState = currentState === 0 ? 1 : 0;
            gpioStates[index] = newState;
            console.log(`[SIMULATION] Button press: Relay ${index} (GPIO ${pin}) toggled to ${newState ? 'HIGH' : 'LOW'}`);
        }
    } catch (err) {
        console.error(`Error toggling Relay ${index} (GPIO ${pin}):`, err.message);
    }
}

if (isRaspberryPi) {
    try {
        Gpio = require('onoff').Gpio;

        // Initialize relay output pins
        GPIO_PINS.forEach((pin, index) => {
            try {
                // Try to unexport first in case it's already exported
                try {
                    const existingGpio = new Gpio(pin+512, 'out');
                    existingGpio.unexport();
                } catch (e) {
                    // Pin wasn't exported, that's fine
                }

                // Now initialize the pin
                gpios[index] = new Gpio(pin+512, 'out');
                gpios[index].writeSync(0); // Initialize to LOW
                console.log(`Relay ${index} (GPIO ${pin}) initialized`);
            } catch (err) {
                console.error(`Error initializing Relay ${index} (GPIO ${pin}):`, err.message);
                console.error(`  Make sure you're running with sudo and the pin is not in use`);
            }
        });

        // Initialize button input pins
        BUTTON_PINS.forEach((pin, index) => {
            try {
                // Try to unexport first in case it's already exported
                try {
                    const existingGpio = new Gpio(pin+512, 'in', 'falling', {debounceTimeout: 50});
                    existingGpio.unexport();
                } catch (e) {
                    // Pin wasn't exported, that's fine
                }

                // Initialize button with pull-up resistor (active low)
                buttons[index] = new Gpio(pin+512, 'in', 'falling', {debounceTimeout: 50});

                // Watch for button presses
                buttons[index].watch((err, value) => {
                    console.log(`watched! value: ${value},  index: ${index}`);
                    if (err) {
                        console.error(`Error watching Button ${index} (GPIO ${pin}):`, err.message);
                        return;
                    }
                    // Button pressed (falling edge - button connects to ground)
                    if (value === 0) {
                        toggleRelay(index);
                    }
                });

                console.log(`Button ${index} (GPIO ${pin}) initialized`);
            } catch (err) {
                console.error(`Error initializing Button ${index} (GPIO ${pin}):`, err.message);
                console.error(`  Make sure you're running with sudo and the pin is not in use`);
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
for (let i = 0; i < GPIO_PINS.length; i++) {
    gpioStates[i] = 0;
}

// API endpoint to set GPIO state
app.post('/gpio/:index/:state', (req, res) => {
    const index = parseInt(req.params.index);
    const state = parseInt(req.params.state);

    // Validate index
    if (index < 0 || index >= GPIO_PINS.length) {
        return res.status(400).json({
            error: 'Invalid relay index',
            validIndices: `0-${GPIO_PINS.length - 1}`
        });
    }

    // Validate state (0 or 1)
    if (state !== 0 && state !== 1) {
        return res.status(400).json({
            error: 'Invalid state. Use 0 (LOW) or 1 (HIGH)'
        });
    }

    const pin = GPIO_PINS[index];

    try {
        if (gpios[index]) {
            // Real GPIO control
            gpios[index].writeSync(state);
            console.log(`Relay ${index} (GPIO ${pin}) set to ${state ? 'HIGH' : 'LOW'}`);
        } else {
            // Simulation mode
            gpioStates[index] = state;
            console.log(`[SIMULATION] Relay ${index} (GPIO ${pin}) set to ${state ? 'HIGH' : 'LOW'}`);
        }

        res.json({
            success: true,
            index: index,
            pin: pin,
            state: state,
            mode: gpios[index] ? 'hardware' : 'simulation'
        });
    } catch (err) {
        console.error(`Error setting Relay ${index} (GPIO ${pin}):`, err.message);
        res.status(500).json({
            error: 'Failed to set GPIO state',
            details: err.message
        });
    }
});

// API endpoint to get GPIO state
app.get('/gpio/:index', (req, res) => {
    const index = parseInt(req.params.index);

    if (index < 0 || index >= GPIO_PINS.length) {
        return res.status(400).json({
            error: 'Invalid relay index',
            validIndices: `0-${GPIO_PINS.length - 1}`
        });
    }

    const pin = GPIO_PINS[index];

    try {
        let state;
        if (gpios[index]) {
            state = gpios[index].readSync();
        } else {
            state = gpioStates[index];
        }

        res.json({
            index: index,
            pin: pin,
            state: state,
            mode: gpios[index] ? 'hardware' : 'simulation'
        });
    } catch (err) {
        console.error(`Error reading Relay ${index} (GPIO ${pin}):`, err.message);
        res.status(500).json({
            error: 'Failed to read GPIO state',
            details: err.message
        });
    }
});

// API endpoint to get all GPIO states
app.get('/gpio', (req, res) => {
    const states = {};

    GPIO_PINS.forEach((pin, index) => {
        try {
            if (gpios[index]) {
                states[index] = gpios[index].readSync();
            } else {
                states[index] = gpioStates[index];
            }
        } catch (err) {
            states[index] = null;
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
app.post('/labels/:index', (req, res) => {
    const index = parseInt(req.params.index);
    const {label} = req.body;

    // Validate index
    if (index < 0 || index >= GPIO_PINS.length) {
        return res.status(400).json({
            error: 'Invalid relay index',
            validIndices: `0-${GPIO_PINS.length - 1}`
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
    gpioLabels[index] = trimmedLabel;
    saveLabels();

    res.json({
        success: true,
        index: index,
        label: trimmedLabel
    });
});

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('\nCleaning up GPIO...');

    // Cleanup relay outputs
    Object.keys(gpios).forEach(index => {
        try {
            gpios[index].writeSync(0);
            gpios[index].unexport();
        } catch (err) {
            console.error(`Error cleaning up Relay ${index}:`, err.message);
        }
    });

    // Cleanup button inputs
    Object.keys(buttons).forEach(index => {
        try {
            buttons[index].unexport();
        } catch (err) {
            console.error(`Error cleaning up Button ${index}:`, err.message);
        }
    });

    process.exit();
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`GPIO Controller running on http://0.0.0.0:${PORT}`);
    console.log(`Mode: ${Object.keys(gpios).length > 0 ? 'Hardware' : 'Simulation'}`);
    console.log(`Relay GPIO pins: ${GPIO_PINS.join(', ')}`);
    console.log(`Button GPIO pins: ${BUTTON_PINS.join(', ')}`);
});
