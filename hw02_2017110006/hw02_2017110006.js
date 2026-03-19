import { resizeAspectRatio, setupText } from './util/util.js';
import { Shader, readShaderFile } from './util/shader.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let shader;
let vao;
let offsetX = 0.0;
let offsetY = 0.0;
const step = 0.01;
const halfSize = 0.1; // half of side length 0.2

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 600;
    canvas.height = 600;

    resizeAspectRatio(gl, canvas);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    return true;
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

function setupKeyboardEvents() {
    window.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown' ||
            event.key === 'ArrowLeft' || event.key === 'ArrowRight') {

            if (event.key === 'ArrowUp') {
                offsetY = Math.min(offsetY + step, 1.0 - halfSize);
            }
            else if (event.key === 'ArrowDown') {
                offsetY = Math.max(offsetY - step, -1.0 + halfSize);
            }
            else if (event.key === 'ArrowLeft') {
                offsetX = Math.max(offsetX - step, -1.0 + halfSize);
            }
            else if (event.key === 'ArrowRight') {
                offsetX = Math.min(offsetX + step, 1.0 - halfSize);
            }
        }
    });
}

function setupBuffers() {
    // Square centered at origin, side length 0.2
    // Using TRIANGLE_FAN: center, then 4 corners
    const vertices = new Float32Array([
        -halfSize, -halfSize, 0.0,  // bottom-left
        halfSize, -halfSize, 0.0,  // bottom-right
        halfSize,  halfSize, 0.0,  // top-right
        -halfSize,  halfSize, 0.0   // top-left
    ]);

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    shader.setAttribPointer('aPos', 3, gl.FLOAT, false, 0, 0);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    shader.setVec2("uOffset", [offsetX, offsetY]);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    requestAnimationFrame(() => render());
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL initialization failed');
        }

        await initShader();

        setupText(canvas, "Use arrow keys to move the rectangle", 1);

        setupKeyboardEvents();

        setupBuffers();
        shader.use();

        render();

    } catch (error) {
        console.error('Failed to initialize program:', error);
    }
}

main();
