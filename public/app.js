// GPIO pins being controlled
const GPIO_PINS = [17, 18, 22, 23, 24, 25, 27, 4];

// Function to set GPIO state
async function setGPIO(pin, state) {
    try {
        // Disable all buttons temporarily
        disableButtons(true);

        const response = await fetch(`/gpio/${pin}/${state}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            updateStatus(pin, state);
            console.log(`GPIO ${pin} set to ${state ? 'HIGH' : 'LOW'}`);
        } else {
            console.error('Error setting GPIO:', data.error);
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Error communicating with server:', error);
        alert('Failed to communicate with server');
    } finally {
        // Re-enable buttons
        disableButtons(false);
    }
}

// Update status display
function updateStatus(pin, state) {
    const statusElement = document.getElementById(`status-${pin}`);
    if (statusElement) {
        statusElement.textContent = state ? 'ON' : 'OFF';
        statusElement.className = state ? 'status on' : 'status off';
    }
}

// Disable/enable all buttons
function disableButtons(disabled) {
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        btn.disabled = disabled;
    });
}

// Load initial GPIO states
async function loadGPIOStates() {
    try {
        const response = await fetch('/gpio');
        const data = await response.json();

        if (data.states) {
            Object.keys(data.states).forEach(pin => {
                const state = data.states[pin];
                if (state !== null) {
                    updateStatus(parseInt(pin), state);
                }
            });

            // Display mode indicator
            if (data.mode === 'simulation') {
                const container = document.querySelector('.container');
                const notice = document.createElement('div');
                notice.style.cssText = 'background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin-bottom: 20px; text-align: center; color: #856404;';
                notice.innerHTML = '<strong>⚠️ Simulation Mode</strong> - Not running on Raspberry Pi';
                container.insertBefore(notice, container.firstChild);
            }
        }
    } catch (error) {
        console.error('Error loading GPIO states:', error);
    }
}

// Load GPIO labels
async function loadGPIOLabels() {
    try {
        const response = await fetch('/labels');
        const data = await response.json();

        if (data.labels) {
            Object.keys(data.labels).forEach(pin => {
                const labelElement = document.getElementById(`label-${pin}`);
                if (labelElement) {
                    labelElement.textContent = data.labels[pin];
                }
            });
        }
    } catch (error) {
        console.error('Error loading GPIO labels:', error);
    }
}

// Function to edit label
function editLabel(pin) {
    const labelElement = document.getElementById(`label-${pin}`);
    const currentLabel = labelElement.textContent;

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentLabel;
    input.className = 'label-edit-input';
    input.maxLength = 50;

    // Replace label with input
    labelElement.replaceWith(input);
    input.focus();
    input.select();

    // Save on blur or enter
    const saveLabel = async () => {
        const newLabel = input.value.trim();

        if (newLabel && newLabel !== currentLabel) {
            try {
                const response = await fetch(`/labels/${pin}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ label: newLabel })
                });

                const data = await response.json();

                if (data.success) {
                    labelElement.textContent = data.label;
                    console.log(`GPIO ${pin} label updated to: ${data.label}`);
                } else {
                    console.error('Error updating label:', data.error);
                    alert(`Error: ${data.error}`);
                    labelElement.textContent = currentLabel;
                }
            } catch (error) {
                console.error('Error communicating with server:', error);
                alert('Failed to update label');
                labelElement.textContent = currentLabel;
            }
        } else {
            labelElement.textContent = currentLabel;
        }

        input.replaceWith(labelElement);
    };

    input.addEventListener('blur', saveLabel);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            labelElement.textContent = currentLabel;
            input.replaceWith(labelElement);
        }
    });
}

// Load states and labels when page loads
window.addEventListener('DOMContentLoaded', () => {
    loadGPIOStates();
    loadGPIOLabels();
});
