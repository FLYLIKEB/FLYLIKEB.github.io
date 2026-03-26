/*-------------------------------------------------------------------------
hw03_2017110006.js

Circle과 Line Segment의 intersection을 구하는 프로그램.

1) 마우스 drag로 circle 입력 (중심점 + 반지름)
2) 마우스 drag로 line segment 입력
3) Line segment 입력 완료 시 intersection 계산 및 표시
---------------------------------------------------------------------------*/
import { resizeAspectRatio, Axes } from './util/util.js';
import { Shader, readShaderFile } from './util/shader.js';

function setupText(canvas, initialText, line) {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.left = canvas.offsetLeft + 10 + 'px';
    overlay.style.top = canvas.offsetTop + (20 * (line - 1) + 10) + 'px';
    overlay.style.color = 'white';
    overlay.style.fontFamily = 'monospace';
    overlay.style.fontSize = '14px';
    overlay.style.zIndex = '100';
    overlay.textContent = initialText;
    canvas.parentElement.appendChild(overlay);
    return overlay;
}

function updateText(overlay, text) {
    if (overlay) overlay.textContent = text;
}

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let isInitialized = false;
let shader;
let vao;
let positionBuffer;
let axes;

// 상태: 'circle' -> circle 입력 대기, 'line' -> line segment 입력 대기, 'done' -> 완료
let state = 'circle';
let isDrawing = false;

// Circle 데이터
let circle = null;          // { cx, cy, r }
let circleCenter = null;    // 드래그 시작점 (중심)
let circleTempR = 0;        // 드래그 중 임시 반지름

// Line segment 데이터
let lineSegment = null;     // [x1, y1, x2, y2]
let lineStart = null;
let lineTempEnd = null;

// Intersection points
let intersections = [];     // [{x, y}, ...]

// Text overlays
let textLine1, textLine2, textLine3;

// Circle을 그리기 위한 세그먼트 수
const CIRCLE_SEGMENTS = 128;

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) return;
    main().then(success => {
        if (!success) return;
        isInitialized = true;
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
    });
});

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }
    canvas.width = 700;
    canvas.height = 700;
    resizeAspectRatio(gl, canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.2, 0.3, 1.0);
    return true;
}

function setupBuffers() {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    shader.setAttribPointer('a_position', 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
}

function convertToWebGLCoordinates(x, y) {
    return [
        (x / canvas.width) * 2 - 1,
        -((y / canvas.height) * 2 - 1)
    ];
}

// Circle 꼭짓점 배열 생성 (NDC 기준)
function buildCircleVertices(cx, cy, r) {
    const verts = [];
    for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
        const angle = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
        verts.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }
    return new Float32Array(verts);
}

// Circle과 Line Segment의 intersection 계산
// circle: {cx, cy, r}, seg: [x1, y1, x2, y2]
// line을 parametric으로 표현: P = P1 + t*(P2-P1), t in [0,1]
function computeIntersections(circ, seg) {
    const [x1, y1, x2, y2] = seg;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - circ.cx;
    const fy = y1 - circ.cy;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - circ.r * circ.r;

    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return [];

    const results = [];
    const sqrtDisc = Math.sqrt(discriminant);

    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);

    const EPS = 1e-9;

    if (t1 >= -EPS && t1 <= 1 + EPS) {
        const t = Math.max(0, Math.min(1, t1));
        results.push({ x: x1 + t * dx, y: y1 + t * dy });
    }

    if (Math.abs(discriminant) > EPS) { // 두 근이 다른 경우만
        if (t2 >= -EPS && t2 <= 1 + EPS) {
            const t = Math.max(0, Math.min(1, t2));
            // 중복 제거
            const pt = { x: x1 + t * dx, y: y1 + t * dy };
            if (results.length === 0 ||
                Math.abs(pt.x - results[0].x) > EPS ||
                Math.abs(pt.y - results[0].y) > EPS) {
                results.push(pt);
            }
        }
    }

    return results;
}

function drawData(vertices, drawMode, color, count) {
    shader.use();
    shader.setVec4('u_color', color);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.bindVertexArray(vao);
    gl.drawArrays(drawMode, 0, count);
    gl.bindVertexArray(null);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    shader.use();

    // 확정된 circle 그리기 (magenta)
    if (circle) {
        const verts = buildCircleVertices(circle.cx, circle.cy, circle.r);
        drawData(verts, gl.LINE_STRIP, [1.0, 0.0, 1.0, 1.0], CIRCLE_SEGMENTS + 1);
    }

    // 드래그 중인 임시 circle 그리기 (gray)
    if (state === 'circle' && isDrawing && circleCenter && circleTempR > 0) {
        const verts = buildCircleVertices(circleCenter[0], circleCenter[1], circleTempR);
        drawData(verts, gl.LINE_STRIP, [0.5, 0.5, 0.5, 1.0], CIRCLE_SEGMENTS + 1);
    }

    // 확정된 line segment 그리기 (red)
    if (lineSegment) {
        drawData(new Float32Array(lineSegment), gl.LINES, [1.0, 0.0, 0.0, 1.0], 2);
    }

    // 드래그 중인 임시 line segment 그리기 (gray)
    if (state === 'line' && isDrawing && lineStart && lineTempEnd) {
        drawData(
            new Float32Array([...lineStart, ...lineTempEnd]),
            gl.LINES, [0.5, 0.5, 0.5, 1.0], 2
        );
    }

    // Intersection points 그리기 (yellow)
    for (const pt of intersections) {
        drawData(new Float32Array([pt.x, pt.y]), gl.POINTS, [1.0, 1.0, 0.0, 1.0], 1);
    }

    // Axes 그리기
    axes.draw(mat4.create(), mat4.create());
}

function setupMouseEvents() {
    function handleMouseDown(event) {
        event.preventDefault();
        event.stopPropagation();

        if (isDrawing) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const [glX, glY] = convertToWebGLCoordinates(x, y);

        if (state === 'circle') {
            circleCenter = [glX, glY];
            circleTempR = 0;
            isDrawing = true;
        } else if (state === 'line') {
            lineStart = [glX, glY];
            lineTempEnd = null;
            isDrawing = true;
        }
    }

    function handleMouseMove(event) {
        if (!isDrawing) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const [glX, glY] = convertToWebGLCoordinates(x, y);

        if (state === 'circle' && circleCenter) {
            const dx = glX - circleCenter[0];
            const dy = glY - circleCenter[1];
            circleTempR = Math.sqrt(dx * dx + dy * dy);
        } else if (state === 'line') {
            lineTempEnd = [glX, glY];
        }

        render();
    }

    function handleMouseUp(event) {
        if (!isDrawing) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const [glX, glY] = convertToWebGLCoordinates(x, y);

        if (state === 'circle' && circleCenter) {
            const dx = glX - circleCenter[0];
            const dy = glY - circleCenter[1];
            const r = Math.sqrt(dx * dx + dy * dy);
            circle = { cx: circleCenter[0], cy: circleCenter[1], r };

            updateText(textLine1,
                `Circle: center (${circle.cx.toFixed(2)}, ${circle.cy.toFixed(2)}) radius = ${circle.r.toFixed(2)}`);
            updateText(textLine2, 'Click and drag to draw the line segment');

            isDrawing = false;
            circleCenter = null;
            circleTempR = 0;
            state = 'line';

        } else if (state === 'line' && lineStart && lineTempEnd) {
            lineSegment = [...lineStart, ...lineTempEnd];

            updateText(textLine2,
                `Line segment: (${lineSegment[0].toFixed(2)}, ${lineSegment[1].toFixed(2)}) ~ (${lineSegment[2].toFixed(2)}, ${lineSegment[3].toFixed(2)})`);

            // Intersection 계산
            intersections = computeIntersections(circle, lineSegment);

            function fmtCoord(v) {
                return (v >= 0 ? '+' : '') + v.toFixed(2);
            }

            if (intersections.length === 0) {
                updateText(textLine3, 'No intersection');
            } else if (intersections.length === 1) {
                const p = intersections[0];
                updateText(textLine3,
                    `Intersection Points: 1 Point 1: (${fmtCoord(p.x)}, ${fmtCoord(p.y)})`);
            } else {
                const p1 = intersections[0];
                const p2 = intersections[1];
                updateText(textLine3,
                    `Intersection Points: 2 Point 1: (${fmtCoord(p1.x)}, ${fmtCoord(p1.y)}) Point 2: (${fmtCoord(p2.x)}, ${fmtCoord(p2.y)})`);
            }

            isDrawing = false;
            lineStart = null;
            lineTempEnd = null;
            state = 'done';
        }

        render();
    }

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
        }

        await initShader();

        setupBuffers();
        shader.use();

        axes = new Axes(gl, 0.85);

        textLine1 = setupText(canvas, 'Click and drag to draw a circle', 1);
        textLine2 = setupText(canvas, '', 2);
        textLine3 = setupText(canvas, '', 3);

        setupMouseEvents();
        render();

        return true;
    } catch (error) {
        console.error('Failed to initialize program:', error);
        return false;
    }
}
