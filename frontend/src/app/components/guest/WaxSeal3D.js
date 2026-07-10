"use client";

import React, { useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   WaxSeal3D — a real-time, monochrome metallic wax seal rendered in WebGL2.

   A 2D canvas bakes a height map (thick raised rim + embossed monogram) and the
   fragment shader relights it every frame: a moving key light, environment
   reflection, fresnel rim and clearcoat gloss. The monogram is read purely
   through relief light/shadow in the SAME metal — exactly like a real pressed
   wax seal (grounded in reference photos), not flat text pasted on colour.

   Props:
     • text        monogram / seal name (supports Arabic)
     • color       metal colour, hex string or [r,g,b] 0..1 (default warm gold)
     • breaking    when true, the seal cracks + flashes + fades (open moment)
     • interactive when true, the seal tilts toward the pointer (3D parallax)
     • animate     when false (reduced motion), the light does not travel
   Gracefully renders a CSS seal if WebGL2 is unavailable, so it never breaks.
   ═══════════════════════════════════════════════════════════════════════════ */

const isArabic = (s) => typeof s === "string" && /[؀-ۿ]/.test(s);

function toRGB(c) {
  if (Array.isArray(c)) return c;
  const h = (c || "#e0b24e").replace("#", "");
  const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const n = parseInt(f, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/* Bake the seal relief (grayscale height) on a 2D canvas. */
const MAP = 512, C0 = 256, R0 = 236;
function bakeHeight(text) {
  const arabic = isArabic(text);
  const len = (text || "").length;
  const fs = arabic ? (len <= 3 ? 182 : len <= 5 ? 146 : 112) : (len <= 2 ? 166 : len <= 3 ? 132 : 100);
  const cv = document.createElement("canvas");
  cv.width = cv.height = MAP;
  const h = cv.getContext("2d");
  h.fillStyle = "#000";
  h.fillRect(0, 0, MAP, MAP);
  // organic disc (slightly wavy edge)
  h.save();
  h.beginPath();
  for (let a = 0; a <= 360; a += 3) {
    const t = (a * Math.PI) / 180;
    const rr = R0 * (1 + 0.012 * Math.sin(t * 7 + 1) + 0.008 * Math.sin(t * 13));
    const px = C0 + rr * Math.cos(t), py = C0 + rr * Math.sin(t);
    if (a === 0) h.moveTo(px, py); else h.lineTo(px, py);
  }
  h.closePath();
  h.clip();
  // flat metal field
  const field = h.createRadialGradient(C0, C0 - 24, 8, C0, C0, R0 * 0.9);
  field.addColorStop(0, "rgba(146,146,146,1)");
  field.addColorStop(0.72, "rgba(130,130,130,1)");
  field.addColorStop(1, "rgba(120,120,120,1)");
  h.fillStyle = field;
  h.fillRect(0, 0, MAP, MAP);
  h.globalCompositeOperation = "lighter";
  // thick raised rounded rim (the characteristic fat wax lip)
  const rim = h.createRadialGradient(C0, C0, R0 * 0.66, C0, C0, R0);
  rim.addColorStop(0.0, "rgba(255,255,255,0)");
  rim.addColorStop(0.5, "rgba(255,255,255,0.05)");
  rim.addColorStop(0.72, "rgba(255,255,255,0.62)");
  rim.addColorStop(0.84, "rgba(255,255,255,0.52)");
  rim.addColorStop(0.96, "rgba(255,255,255,0.12)");
  rim.addColorStop(1.0, "rgba(255,255,255,0)");
  h.fillStyle = rim;
  h.fillRect(0, 0, MAP, MAP);
  // embossed monogram — same metal, read through relief only
  h.fillStyle = "rgba(255,255,255,0.58)";
  h.textAlign = "center";
  h.textBaseline = "middle";
  h.font = "600 " + fs + "px " + (arabic ? "'Aref Ruqaa','Amiri',Georgia,serif" : "Georgia,serif");
  h.fillText(text || "", C0, C0 + 4);
  h.restore();
  return cv;
}

const VERT =
  "#version 300 es\nin vec2 aPos; out vec2 vUv; void main(){ vUv=aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0); }";
const FRAG =
  "#version 300 es\n" +
  "precision highp float; in vec2 vUv; out vec4 frag;\n" +
  "uniform sampler2D uH; uniform float uTime; uniform vec2 uTilt; uniform float uBreak;\n" +
  "uniform vec3 uGold; uniform vec3 uLight; uniform vec3 uEnvHi; uniform vec3 uEnvLo; uniform vec3 uRim; uniform float uBump;\n" +
  "float H(vec2 uv){ return texture(uH,uv).r; }\n" +
  "float hash(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453); }\n" +
  "vec3 env(vec3 d){ float y=d.y*0.5+0.5; vec3 s=mix(uEnvLo,uEnvHi,smoothstep(0.0,1.0,y));\n" +
  "  float st=pow(max(dot(d,normalize(uLight)),0.0),36.0); return s+st*vec3(1.0,0.93,0.8)*1.6; }\n" +
  "void main(){\n" +
  "  vec2 p=vUv*2.0-1.0; float r=length(p);\n" +
  "  vec3 V=normalize(vec3(-uTilt*0.9,1.0));\n" +
  "  float h0=H(vUv); vec2 uv=vUv+uTilt*(h0-0.35)*0.10;\n" +
  "  float e=1.0/512.0;\n" +
  "  float hl=H(uv-vec2(e,0.0)),hr=H(uv+vec2(e,0.0)),hd=H(uv-vec2(0.0,e)),hu=H(uv+vec2(0.0,e)),hh=H(uv);\n" +
  "  vec3 N=normalize(vec3((hl-hr)*uBump,(hd-hu)*uBump,1.0)); N.xy+=uTilt*0.35; N=normalize(N);\n" +
  "  N.xy+=(vec2(hash(uv*480.0),hash(uv*480.0+7.0))-0.5)*0.05; N=normalize(N);\n" +
  "  float cov=smoothstep(0.05,0.11,hh); if(cov<0.01){ frag=vec4(0.0); return; }\n" +
  "  float la=uTime*0.55; vec3 L=normalize(vec3(cos(la)*0.7,0.4+sin(la)*0.28,0.72));\n" +
  "  float ndl=max(dot(N,L),0.0); vec3 Hh=normalize(L+V); float ndh=max(dot(N,Hh),0.0);\n" +
  "  float broad=pow(ndh,14.0), sharp=pow(ndh,150.0), fres=pow(1.0-max(dot(N,V),0.0),4.0);\n" +
  "  vec3 Rf=reflect(-V,N); vec3 en=env(Rf); float ao=mix(0.4,1.0,smoothstep(0.02,0.6,hh));\n" +
  "  vec3 col=en*uGold*0.8 + sharp*mix(uGold,vec3(1.0),0.7)*1.9 + broad*uGold*0.6 + uGold*(0.05+0.9*ndl)*ao + fres*mix(uGold,vec3(1.0),0.4)*0.6;\n" +
  "  col*=mix(1.0,0.82,smoothstep(0.75,1.0,r));\n" +
  "  float wav=p.y - sin(p.x*7.0+1.5)*0.06 - (hash(p*20.0)-0.5)*0.05;\n" +
  "  float crack=(1.0-smoothstep(0.0,0.015+uBreak*0.07,abs(wav)))*uBreak;\n" +
  "  col=mix(col,vec3(0.0),crack*0.75); col+=crack*uLight*2.2; col+=uBreak*uBreak*0.7*uLight;\n" +
  "  cov*=(1.0-smoothstep(0.55,1.0,uBreak));\n" +
  "  frag=vec4(col,cov);\n" +
  "}";

export default function WaxSeal3D({ text = "", color = "#e0b24e", breaking = false, interactive = true, animate = true, className, style }) {
  const canvasRef = useRef(null);
  const apiRef = useRef(null);
  // Latest props for the render loop / handlers to read without re-running setup.
  const live = useRef({ text, color, breaking, interactive, animate });
  live.current.text = text;
  live.current.color = color;
  live.current.breaking = breaking;
  live.current.interactive = interactive;
  live.current.animate = animate;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let gl = null;
    try { gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, antialias: true }); } catch { /* no webgl2 */ }
    if (!gl) {
      // CSS fallback — a simple lit gold disc so it never looks broken.
      canvas.style.display = "none";
      const fb = document.createElement("div");
      fb.textContent = live.current.text || "";
      Object.assign(fb.style, {
        position: "absolute", inset: "0", borderRadius: "50%", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "radial-gradient(circle at 38% 32%, #f4dd9e, " + (typeof color === "string" ? color : "#c69a45") + " 46%, #6a4e1c 100%)",
        boxShadow: "inset 0 -8px 20px rgba(0,0,0,.5), inset 0 6px 14px rgba(255,240,210,.25), 0 20px 40px rgba(0,0,0,.5)",
        fontFamily: "var(--font-serif), Georgia, serif", fontWeight: "700",
        fontSize: "clamp(20px,7vw,44px)", color: "#3a2a10",
      });
      canvas.parentNode && canvas.parentNode.appendChild(fb);
      apiRef.current = { setMaps: (t) => { fb.textContent = t || ""; }, setColor: () => {} };
      return () => { fb.remove(); canvas.style.display = ""; apiRef.current = null; };
    }

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error("WaxSeal3D shader:", gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const uploadMaps = (t) => {
      const cv = bakeHeight(t);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    };

    const U = {};
    ["uH", "uTime", "uTilt", "uBreak", "uGold", "uLight", "uEnvHi", "uEnvLo", "uRim", "uBump"].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(U.uH, 0);
    gl.uniform3f(U.uLight, 1.0, 0.95, 0.84);
    gl.uniform3f(U.uEnvHi, 0.32, 0.22, 0.12);
    gl.uniform3f(U.uEnvLo, 0.03, 0.025, 0.03);
    gl.uniform3f(U.uRim, 1.0, 0.86, 0.6);
    gl.uniform1f(U.uBump, 4.4);
    const setColor = (c) => { const rgb = toRGB(c); gl.uniform3f(U.uGold, rgb[0], rgb[1], rgb[2]); };
    setColor(live.current.color);
    uploadMaps(live.current.text);
    apiRef.current = { setMaps: uploadMaps, setColor };

    // pointer tilt
    let hover = false, tTilt = [0, 0];
    const cTilt = [0, 0];
    let breakP = 0;
    const onMove = (ev) => {
      if (!live.current.interactive) return;
      const b = canvas.getBoundingClientRect();
      tTilt = [(ev.clientX - b.left) / b.width - 0.5, (ev.clientY - b.top) / b.height - 0.5];
      hover = true;
    };
    const onLeave = () => { hover = false; };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const W = Math.max(1, Math.round(w * dpr)), Hp = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== W || canvas.height !== Hp) { canvas.width = W; canvas.height = Hp; gl.viewport(0, 0, W, Hp); }
    };

    const t0 = performance.now();
    let raf = 0, lastColor = live.current.color, lastText = live.current.text;
    const frame = (now) => {
      resize();
      if (live.current.color !== lastColor) { lastColor = live.current.color; setColor(lastColor); }
      if (live.current.text !== lastText) { lastText = live.current.text; uploadMaps(lastText); }
      const time = live.current.animate ? (now - t0) / 1000 : 1.2;
      const idle = live.current.animate ? [Math.sin(time * 0.5) * 0.12, Math.cos(time * 0.42) * 0.08] : [0, 0];
      const target = hover ? tTilt : idle;
      cTilt[0] += (target[0] - cTilt[0]) * 0.08;
      cTilt[1] += (target[1] - cTilt[1]) * 0.08;
      breakP += ((live.current.breaking ? 1 : 0) - breakP) * (live.current.breaking ? 0.06 : 0.5);
      gl.uniform1f(U.uTime, time);
      gl.uniform2f(U.uTilt, cTilt[0], cTilt[1]);
      gl.uniform1f(U.uBreak, breakP);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      apiRef.current = null;
      try {
        gl.deleteTexture(tex);
        gl.deleteBuffer(quad);
        gl.deleteProgram(prog);
        const ext = gl.getExtension("WEBGL_lose_context");
        ext && ext.loseContext();
      } catch { /* context already gone */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className={className} style={{ display: "block", width: "100%", height: "100%", ...style }} aria-label="Invitation wax seal" />;
}
