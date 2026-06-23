// CRT Shader Pipeline for Phaser 3
// Full GLSL shader with scanlines, curvature, chromatic aberration, noise, vignette

const CRTShader = `
#define PI 3.14159265359

precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 resolution;
uniform float time;
uniform float scanlineIntensity;
uniform float curvature;
uniform float vignetteIntensity;
uniform float noiseIntensity;
uniform float chromaticIntensity;

varying vec2 outTexCoord;

// Random function for noise
float random(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

// Scanline effect
float scanline(vec2 uv, float intensity) {
    float scan = sin(uv.y * resolution.y * PI) * 0.5 + 0.5;
    return pow(scan, intensity) * 0.1 + 0.9;
}

// Screen curvature
vec2 curve(vec2 uv, float amount) {
    uv = uv * 2.0 - 1.0;
    uv *= 1.05;
    uv.x *= 1.0 + pow(abs(uv.y) / amount, 2.0);
    uv.y *= 1.0 + pow(abs(uv.x) / amount, 2.0);
    uv = uv * 0.5 + 0.5;
    return uv;
}

// Vignette effect
float vignette(vec2 uv, float intensity) {
    vec2 dist = uv - 0.5;
    return 1.0 - dot(dist, dist) * intensity;
}

// Chromatic aberration
vec3 chromatic(sampler2D sampler, vec2 uv, float amount) {
    float r = texture2D(sampler, uv + vec2(amount, 0.0)).r;
    float g = texture2D(sampler, uv).g;
    float b = texture2D(sampler, uv - vec2(amount, 0.0)).b;
    return vec3(r, g, b);
}

void main() {
    vec2 uv = outTexCoord;
    
    // Apply curvature
    vec2 curvedUV = curve(uv, curvature);
    
    // Chromatic aberration
    vec3 color = chromatic(uMainSampler, curvedUV, chromaticIntensity / resolution.x);
    
    // Scanlines
    float scan = scanline(curvedUV, scanlineIntensity);
    color *= scan;
    
    // Vignette
    float vig = vignette(curvedUV, vignetteIntensity);
    color *= vig;
    
    // Noise
    float noise = random(curvedUV + time) * noiseIntensity;
    color += noise;
    
    // Darken edges
    if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
        color = vec3(0.0);
    }
    
    gl_FragColor = vec4(color, 1.0);
}
`;

class CRTPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    constructor(game) {
        super({
            game: game,
            fragShader: CRTShader,
            uniforms: [
                'uProjectionMatrix',
                'uViewMatrix',
                'uModelMatrix',
                'uMainSampler',
                'resolution',
                'time',
                'scanlineIntensity',
                'curvature',
                'vignetteIntensity',
                'noiseIntensity',
                'chromaticIntensity'
            ]
        });
    }
    
    onBoot() {
        this.set2f('resolution', this.renderer.width, this.renderer.height);
        this.set1f('scanlineIntensity', 1.2);
        this.set1f('curvature', 2.0);
        this.set1f('vignetteIntensity', 2.5);
        this.set1f('noiseIntensity', 0.04);
        this.set1f('chromaticIntensity', 3.0);
    }
    
    onRender() {
        this.set1f('time', this.game.loop.time / 1000);
    }
}

// Export for use in script.js
if (typeof window !== 'undefined') {
    window.CRTPipeline = CRTPipeline;
}
