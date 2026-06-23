// CRT Filter for Phaser 4 (4.2.0+)
//
// Full-screen GLSL post-processing applied to the main camera via Phaser 4's
// Filter system. This replaces the old Phaser 3 SinglePipeline approach
// (Phaser.Renderer.WebGL.Pipelines.SinglePipeline), which no longer exists in
// Phaser 4 — the pipeline system was replaced by camera Filters + RenderNodes.
//
// How it fits together:
//   CRTFilterRenderNode (extends BaseFilterShader) -- runs the fragment shader.
//     The renderer auto-binds the rendered scene to `uMainSampler` (unit 0).
//   CRTFilter (extends Filters.Controller) -- holds the tunable params and is
//     what you attach to a camera's filter list.
//   installCRTFilter(scene, camera) -- registers the node once and attaches the
//     controller to camera.filters.internal (full-screen, screen-aligned).

const CRTShader = `
#define PI 3.14159265359

precision mediump float;

uniform sampler2D uMainSampler;   // rendered scene, auto-bound to texture unit 0
uniform vec2 resolution;
uniform float time;
uniform float scanlineIntensity;
uniform float curvature;
uniform float vignetteIntensity;
uniform float noiseIntensity;
uniform float chromaticIntensity;

varying vec2 outTexCoord;

float random(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float scanline(vec2 uv, float intensity) {
    float scan = sin(uv.y * resolution.y * PI) * 0.5 + 0.5;
    return pow(scan, intensity) * 0.1 + 0.9;
}

vec2 curve(vec2 uv, float amount) {
    uv = uv * 2.0 - 1.0;
    uv *= 1.05;
    uv.x *= 1.0 + pow(abs(uv.y) / amount, 2.0);
    uv.y *= 1.0 + pow(abs(uv.x) / amount, 2.0);
    uv = uv * 0.5 + 0.5;
    return uv;
}

float vignette(vec2 uv, float intensity) {
    vec2 dist = uv - 0.5;
    return 1.0 - dot(dist, dist) * intensity;
}

vec3 chromatic(sampler2D sampler, vec2 uv, float amount) {
    float r = texture2D(sampler, uv + vec2(amount, 0.0)).r;
    float g = texture2D(sampler, uv).g;
    float b = texture2D(sampler, uv - vec2(amount, 0.0)).b;
    return vec3(r, g, b);
}

void main() {
    vec2 uv = outTexCoord;

    vec2 curvedUV = curve(uv, curvature);

    vec3 color = chromatic(uMainSampler, curvedUV, chromaticIntensity / resolution.x);

    float scan = scanline(curvedUV, scanlineIntensity);
    color *= scan;

    float vig = vignette(curvedUV, vignetteIntensity);
    color *= vig;

    float noise = random(curvedUV + time) * noiseIntensity;
    color += noise;

    // Black outside the curved screen edge
    if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
        color = vec3(0.0);
    }

    gl_FragColor = vec4(color, 1.0);
}
`;

// --- Render node: executes the fragment shader against the scene framebuffer ---
class CRTFilterRenderNode extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader {
    constructor(manager) {
        // (name, manager, fragmentKey, fragmentSource) — inline source wins.
        super('CRTFilter', manager, null, CRTShader);
    }

    // Called automatically each render. uMainSampler (the scene) is auto-bound by
    // the base class to unit 0 — we only set our own uniforms.
    setupUniforms(controller, drawingContext) {
        const pm = this.programManager;
        pm.setUniform('resolution', [drawingContext.width, drawingContext.height]);
        // Wall-clock time keeps noise/animation moving without depending on the
        // exact shape of Phaser's loop API (the one cross-version-ambiguous bit).
        pm.setUniform('time', (performance.now() / 1000) % 3600);
        pm.setUniform('scanlineIntensity', controller.scanlineIntensity);
        pm.setUniform('curvature', controller.curvature);
        pm.setUniform('vignetteIntensity', controller.vignetteIntensity);
        pm.setUniform('noiseIntensity', controller.noiseIntensity);
        pm.setUniform('chromaticIntensity', controller.chromaticIntensity);
    }
}

// --- Controller: tunable parameters + the thing you attach to a camera ---
class CRTFilter extends Phaser.Filters.Controller {
    constructor(camera) {
        super(camera, 'CRTFilter'); // 2nd arg must match the registered node name
        // Defaults tuned to stay readable for an arcade game. Tweak freely.
        this.scanlineIntensity = 1.2;
        this.curvature = 4.0;          // higher = flatter (less aggressive than old 2.0)
        this.vignetteIntensity = 1.3;
        this.noiseIntensity = 0.015;   // subtle grain; higher washes out small text
        this.chromaticIntensity = 1.0; // RGB split in px-ish; higher blurs text
    }
}

// Register the render node once per renderer, then attach a controller to the
// camera's internal filter list (internal = filtered in isolation at the
// camera's exact screen position — the correct choice for a full-screen post-FX).
// Returns the controller, or null if filters/renderer aren't available.
function installCRTFilter(scene, camera) {
    const renderer = scene.renderer || (scene.game && scene.game.renderer);
    const rn = renderer && renderer.renderNodes;
    if (!rn || typeof rn.addNodeConstructor !== 'function') {
        return null; // Canvas renderer or unexpected API — fail soft.
    }
    if (!rn.hasNode('CRTFilter')) {
        rn.addNodeConstructor('CRTFilter', CRTFilterRenderNode);
    }
    if (!camera.filters || !camera.filters.internal) {
        return null;
    }
    return camera.filters.internal.add(new CRTFilter(camera));
}

if (typeof window !== 'undefined') {
    window.CRTFilter = CRTFilter;
    window.CRTFilterRenderNode = CRTFilterRenderNode;
    window.installCRTFilter = installCRTFilter;
}
