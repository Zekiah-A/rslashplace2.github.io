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

    let dragging = false
    let dragX = 0
    let dragY = 0

    overlayMenuCanvas.onmousedown = function() {
        dragging = true
    }
    overlayMenuCanvas.onmousemove = function(event) {
        if (dragging) {
            dragX += event.movementX
            dragY += event.movementY
        }
    }
    overlayMenuCanvas.onmouseup = function() {
        dragging = false
    }

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

    function getBounds(x, y, width, height) {
        const canvasWidth = overlayMenuCanvas.width
        const canvasHeight = overlayMenuCanvas.height

        const scaleX = canvasWidth / window.innerWidth
        const scaleY = canvasHeight / window.innerHeight

        const startX = x * scaleX
        const startY = y * scaleY
        const endX = (x + width) * scaleX
        const endY = (y + height) * scaleY

        return { sx: startX, sy: startY, ex: endX, ey: endY }
    }

    function drawOverlay() {
        if (overlayCanvasHandle === null) {
            return
        }
        const oldShader = ctx.useShader(canvasShader)
        const canvasBounds = getBounds(dragX, dragY, 1000, 1000)
        const canvasMesh = Mesh.singleRect(canvasBounds.sx, canvasBounds.sy,
            canvasBounds.ex, canvasBounds.ey)
        ctx.draw(canvasMesh, [canvasTex, paletteTex])
        ctx.useShader(oldShader)

        overlayCanvasHandle = requestAnimationFrame(drawOverlay)
    }
    overlayCanvasHandle = requestAnimationFrame(drawOverlay)
}

function clearOverlayImage() {
    cancelAnimationFrame(overlayCanvasHandle)
    overlayCanvasHandle = null
}