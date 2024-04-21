//@ts-nocheck
let overlayCanvasHandle = null

function updateOverlayImage() {
    if (!overlayMenu.open) {
        return
    }
    if (overlayCanvasHandle !== null) {
        clearOverlayImage()
    }
    const ctx = setTargetCanvas(overlayMenuCanvas)
    overlayMenuCanvas.width = overlayMenuInnerBox.offsetWidth
    overlayMenuCanvas.height = overlayMenuInnerBox.offsetHeight

    const canvasTex = Texture(WIDTH, HEIGHT, _, Formats.R8, PIXELATED)
    canvasTex.putData(0, 0, WIDTH, HEIGHT, board)

    const paletteLength = PALETTE.length
    const paletteData = new Uint8Array((new Uint32Array(PALETTE)).buffer)
    const paletteTex = Texture(paletteLength, 1, _, Formats.RGBA8, PIXELATED)
    paletteTex.putData(0, 0, paletteLength, 1, paletteData)

    const canvasShader = Shader(`
        void main()
        {
            uint index = texture(utex0, vec2(uv.x, 1.0 - uv.y)).r;
            uvec4 c = texelFetch(utex1, ivec2(index, 0), 0);
            float r = float(c.r) / 255.0;
            float g = float(c.g) / 255.0;
            float b = float(c.b) / 255.0;
            color = vec4(r, g, b, 1.0);
        }
    `)

    function drawOverlay() {
        if (overlayCanvasHandle === null) {
            return
        }
        const oldShader = ctx.useShader(canvasShader)
        const imgMesh = Mesh.singleRect(0, 0, 1, 1)
        ctx.draw(imgMesh, [canvasTex, paletteTex])
        ctx.useShader(oldShader)

        overlayCanvasHandle = requestAnimationFrame(drawOverlay)
    }
    overlayCanvasHandle = requestAnimationFrame(drawOverlay)
}

function clearOverlayImage() {
    cancelAnimationFrame(overlayCanvasHandle)
    overlayCanvasHandle = null
}