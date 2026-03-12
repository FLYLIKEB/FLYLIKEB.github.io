// Global constants
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');

if (!gl) {
    console.error('WebGL 2 is not supported by your browser.');
}

// Set initial canvas size: 500 x 500
canvas.width = 500;
canvas.height = 500;

// Enable scissor test for multi-region clear
gl.enable(gl.SCISSOR_TEST);

// Start rendering
render();

// Render each of the 4 quadrants with its color
// WebGL origin is bottom-left, so:
//   bottom-left = Blue, bottom-right = Yellow
//   top-left    = Green, top-right  = Red
function render() {
    const w = canvas.width;
    const h = canvas.height;
    const hw = Math.floor(w / 2);
    const hh = Math.floor(h / 2);

    // Top-left: Green
    gl.viewport(0, hh, hw, hh);
    gl.scissor(0, hh, hw, hh);
    gl.clearColor(0.0, 1.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Top-right: Red
    gl.viewport(hw, hh, w - hw, hh);
    gl.scissor(hw, hh, w - hw, hh);
    gl.clearColor(1.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Bottom-left: Blue
    gl.viewport(0, 0, hw, hh);
    gl.scissor(0, 0, hw, hh);
    gl.clearColor(0.0, 0.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Bottom-right: Yellow
    gl.viewport(hw, 0, w - hw, hh);
    gl.scissor(hw, 0, w - hw, hh);
    gl.clearColor(1.0, 1.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
}

// Resize: maintain 1:1 aspect ratio
window.addEventListener('resize', () => {
    const size = Math.min(window.innerWidth, window.innerHeight);
    canvas.width = size;
    canvas.height = size;
    render();
});
