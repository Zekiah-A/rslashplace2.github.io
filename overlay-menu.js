let overlayCanvasHandle = null

function updateOverlayImage() {
    if (!overlayMenu.open) {
        return
    }
    if (overlayCanvasHandle !== null) {
        clearOverlayImage()
    }

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
    window.addEventListener("resize", resizeViewport)

    /** @type {WebGL2RenderingContext} */
    const gl = overlayMenuCanvas.getContext("webgl2")
    const vertexSource = `#version 300 es
        precision mediump float;
        in vec4 aVertexPosition;
        in vec2 aTextureCoord;
        out vec2 vTextureCoord;
        void main() {
            gl_Position = aVertexPosition;
            vTextureCoord = aTextureCoord;
        }
    `
    const boardFragSource = `#version 300 es
        precision mediump float;
        in vec2 vTextureCoord;
        uniform sampler2D utex0;
        uniform sampler2D utex2;
        out vec4 colour;
        void main() {
            vec2 uv = vTextureCoord / ;
            float index = texture(utex0, vec2(uv.x, 1.0 - uv.y)).r;
            vec4 c = texelFetch(utex2, ivec2(int(index), 0), 0);
            colour = vec4(c.r, 0.0, 0.0, 1.0);
        }
    `

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexSource)
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, boardFragSource)
    const shaderProgram = gl.createProgram()
    if (shaderProgram === null) return
    gl.attachShader(shaderProgram, vertexShader)
    gl.attachShader(shaderProgram, fragmentShader)
    gl.linkProgram(shaderProgram)
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error("Failed to initialise offset canvas shader program:", gl.getProgramInfoLog(shaderProgram))
        return
    }

    gl.useProgram(shaderProgram)
    const vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "aVertexPosition")
    const textureCoordAttrib = gl.getAttribLocation(shaderProgram, "aTextureCoord")
    const boardTexAttrib = gl.getUniformLocation(shaderProgram, "utex0")
    const paletteTexAttrib = gl.getUniformLocation(shaderProgram, "utex1")

    // Geometry
    const positions = new Float32Array([
        -1.0,  1.0,
        -1.0, -1.0,
        1.0,  1.0,
        1.0, -1.0,
    ])
    const textureCoordinates = new Float32Array([
        0.0, 1.0,
        0.0, 0.0,
        1.0, 1.0,
        1.0, 0.0,
    ])
    const positionBuffer = makeBoundBuffer(gl, positions, vertexPositionAttrib)
    const textureCoordBuffer = makeBoundBuffer(gl, textureCoordinates, textureCoordAttrib)

    // Board int texture
    const boardTex = makePixellatedTex(gl)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    const boardData = board
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, WIDTH, HEIGHT, 0, gl.RED, gl.UNSIGNED_BYTE, boardData)

    const paletteTex = makePixellatedTex(gl)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    const paletteData = new Uint8Array(new Uint32Array(PALETTE).buffer) 
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, PALETTE.length / 4, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, paletteData)

    // Draw
    gl.useProgram(shaderProgram)
    gl.uniform1i(boardTexAttrib, 0)
    gl.uniform1i(paletteTexAttrib, 1)

    function makePixellatedTex(gl) {
        const tex = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, tex)    
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        return tex
    }

    function makeBoundBuffer(gl, data, attribLocation) {
        const glBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, glBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
        gl.vertexAttribPointer(attribLocation, 2, gl.FLOAT, false, 0, 0)
        gl.enableVertexAttribArray(attribLocation)
        return glBuffer
    }

    function loadShader(gl, type, source) {
        const shader = gl.createShader(type)
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Failed to compile overlay shader: ", gl.getShaderInfoLog(shader))
            gl.deleteShader(shader)
            return null
        }
        return shader
    }

    resizeViewport()
    function resizeViewport() {
        overlayMenuCanvas.width = overlayMenuInnerBox.offsetWidth
        overlayMenuCanvas.height = overlayMenuInnerBox.offsetHeight
        gl.viewport(0, 0, overlayMenuCanvas.width, overlayMenuCanvas.height)
    }

    function drawOverlay() {
        if (overlayCanvasHandle === null) {
            return
        }
        gl.clearColor(0.0, 0.0, 0.0, 1.0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)    

        overlayCanvasHandle = requestAnimationFrame(drawOverlay)
    }
    overlayCanvasHandle = requestAnimationFrame(drawOverlay)
}

function clearOverlayImage() {
    cancelAnimationFrame(overlayCanvasHandle)
    overlayCanvasHandle = null
}