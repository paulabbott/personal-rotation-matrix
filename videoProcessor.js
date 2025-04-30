class VideoProcessor {
    constructor(videoElement, overlayCanvas, shaderCanvas, shaderOverlayCanvas) {
        this.video = videoElement;
        this.overlayCanvas = overlayCanvas;
        this.shaderCanvas = shaderCanvas;
        this.shaderOverlayCanvas = shaderOverlayCanvas;
        this.glContext = new WebGLContext(shaderCanvas);
        this.ctx = overlayCanvas.getContext('2d');
        this.shaderCtx = shaderOverlayCanvas.getContext('2d');
        this.gridSize = 4;
        this.squareSize = 0;

        // Initialize hand tracker
        this.handTracker = new HandTracker(videoElement, overlayCanvas);

        // Grid rotation state
        this.gridRotation = Array(4).fill().map(() => Array(4).fill(0));
        this.flashTimers = Array(4).fill().map(() => Array(4).fill(0));

        this.setup();
    }

    async setup() {
        try {
            // First setup the video stream
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            this.video.srcObject = stream;

            await new Promise((resolve) => {
                this.video.addEventListener('loadedmetadata', resolve);
            });

            // Initialize WebGL and shaders first
            this.initializeWebGL();
            this.setupEventListeners();
            this.startRendering();

            // Then setup hand tracking in the background
            await this.handTracker.setup();
        } catch (error) {
            console.error('Error setting up video:', error);
        }
    }

    initializeWebGL() {
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0, 1);
                v_texCoord = a_texCoord;
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_texture;
            uniform vec2 u_squarePos[16];
            uniform vec2 u_squareSize[16];
            uniform float u_squareRotation[16];
            
            vec2 rotate(vec2 coord, float angle) {
                float s = sin(angle);
                float c = cos(angle);
                return vec2(
                    coord.x * c - coord.y * s,
                    coord.x * s + coord.y * c
                );
            }
            
            void main() {
                vec2 coord = v_texCoord;
                
                // Flip the entire image horizontally
                coord.x = 1.0 - coord.x;
                
                // Check each square
                for (int i = 0; i < 16; i++) {
                    if (coord.x >= u_squarePos[i].x && 
                        coord.x <= u_squarePos[i].x + u_squareSize[i].x &&
                        coord.y >= u_squarePos[i].y && 
                        coord.y <= u_squarePos[i].y + u_squareSize[i].y) {
                        
                        // Convert to local coordinates (0 to 1)
                        vec2 localCoord = (coord - u_squarePos[i]) / u_squareSize[i];
                        
                        // Center the coordinates (-0.5 to 0.5)
                        localCoord = localCoord - vec2(0.5);
                        
                        // Rotate
                        localCoord = rotate(localCoord, u_squareRotation[i]);
                        
                        // Move back to 0 to 1 range
                        localCoord = localCoord + vec2(0.5);
                        
                        // Convert back to texture coordinates
                        coord = u_squarePos[i] + localCoord * u_squareSize[i];
                    }
                }
                
                gl_FragColor = texture2D(u_texture, coord);
            }
        `;

        this.glContext.createProgram(vertexShaderSource, fragmentShaderSource);
        this.glContext.createTexture();

        const positions = new Float32Array([
            -1.0, -1.0,
            1.0, -1.0,
            -1.0, 1.0,
            1.0, 1.0,
        ]);

        const texCoords = new Float32Array([
            0.0, 1.0,
            1.0, 1.0,
            0.0, 0.0,
            1.0, 0.0,
        ]);

        this.glContext.buffers.position = this.glContext.createBuffer(positions);
        this.glContext.buffers.texCoord = this.glContext.createBuffer(texCoords);
    }

    setupEventListeners() {
        this.video.addEventListener('loadeddata', () => this.updateCanvasSizes());
        window.addEventListener('resize', () => this.updateCanvasSizes());
    }

    updateCanvasSizes() {
        const container = this.video.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        const videoAspect = this.video.videoWidth / this.video.videoHeight;
        const containerAspect = containerWidth / containerHeight;
        let videoWidth, videoHeight;

        // Scale to fill container while maintaining aspect ratio
        if (videoAspect > containerAspect) {
            // Video is wider than container, scale by height
            videoHeight = containerHeight;
            videoWidth = videoHeight * videoAspect;
        } else {
            // Video is taller than container, scale by width
            videoWidth = containerWidth;
            videoHeight = videoWidth / videoAspect;
        }

        this.overlayCanvas.width = videoWidth;
        this.overlayCanvas.height = videoHeight;
        this.shaderCanvas.width = this.video.videoWidth;
        this.shaderCanvas.height = this.video.videoHeight;
        this.shaderOverlayCanvas.width = videoWidth;
        this.shaderOverlayCanvas.height = videoHeight;

        this.glContext.gl.viewport(0, 0, this.shaderCanvas.width, this.shaderCanvas.height);
        this.drawSquares();
    }

    drawSquares() {
        // Draw on left overlay
        this.ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        // Calculate square size based on grid
        const padding = 1; // pixels between squares
        const totalPadding = padding * (this.gridSize + 1);
        const availableWidth = this.overlayCanvas.width - totalPadding;
        const availableHeight = this.overlayCanvas.height - totalPadding;
        this.squareSize = Math.min(
            availableWidth / this.gridSize,
            availableHeight / this.gridSize
        );

        // Calculate total grid width and horizontal centering offset
        const totalGridWidth = (this.squareSize * this.gridSize) + (padding * (this.gridSize - 1));
        const horizontalOffset = (this.overlayCanvas.width - totalGridWidth) / 2;

        // Draw grid of squares on left overlay
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const x = horizontalOffset + padding + col * (this.squareSize + padding);
                const y = padding + row * (this.squareSize + padding);

                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(x, y, this.squareSize, this.squareSize);
            }
        }

        // Draw on right overlay
        this.shaderCtx.clearRect(0, 0, this.shaderOverlayCanvas.width, this.shaderOverlayCanvas.height);

        // Draw grid of squares on right overlay
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const x = horizontalOffset + padding + col * (this.squareSize + padding);
                const y = padding + row * (this.squareSize + padding);

                this.shaderCtx.strokeStyle = 'white';
                this.shaderCtx.lineWidth = 1;
                this.shaderCtx.strokeRect(x, y, this.squareSize, this.squareSize);
            }
        }
    }

    // Helper function to get grid cell index from screen coordinates
    getGridCellIndex(x, y) {
        const padding = 1;
        const totalGridWidth = (this.squareSize * this.gridSize) + (padding * (this.gridSize - 1));
        const horizontalOffset = (this.overlayCanvas.width - totalGridWidth) / 2;

        // Convert screen coordinates to grid coordinates
        const gridX = Math.floor((x - horizontalOffset - padding) / (this.squareSize + padding));
        const gridY = Math.floor((y - padding) / (this.squareSize + padding));

        // Return null if outside grid
        if (gridX < 0 || gridX >= this.gridSize || gridY < 0 || gridY >= this.gridSize) {
            return null;
        }

        return { row: gridY, col: gridX };
    }

    render() {
        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            const gl = this.glContext.gl;

            gl.bindTexture(gl.TEXTURE_2D, this.glContext.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);

            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);

            this.glContext.setAttribute('a_position', this.glContext.buffers.position, 2);
            this.glContext.setAttribute('a_texCoord', this.glContext.buffers.texCoord, 2);

            // Calculate positions and rotations for all squares
            const squarePositions = [];
            const squareSizes = [];
            const squareRotations = [];
            const padding = 1;

            // Calculate total grid width and horizontal centering offset
            const totalGridWidth = (this.squareSize * this.gridSize) + (padding * (this.gridSize - 1));
            const horizontalOffset = (this.overlayCanvas.width - totalGridWidth) / 2;

            for (let row = 0; row < this.gridSize; row++) {
                for (let col = 0; col < this.gridSize; col++) {
                    const x = (horizontalOffset + padding + col * (this.squareSize + padding)) / this.overlayCanvas.width;
                    const y = (padding + row * (this.squareSize + padding)) / this.overlayCanvas.height;
                    const width = this.squareSize / this.overlayCanvas.width;
                    const height = this.squareSize / this.overlayCanvas.height;

                    squarePositions.push(x, y);
                    squareSizes.push(width, height);
                    squareRotations.push(this.gridRotation[row][col]);
                }
            }

            // Set uniform arrays
            for (let i = 0; i < 16; i++) {
                this.glContext.setUniform(`u_squarePos[${i}]`, '2f',
                    squarePositions[i * 2],
                    squarePositions[i * 2 + 1]
                );
                this.glContext.setUniform(`u_squareSize[${i}]`, '2f',
                    squareSizes[i * 2],
                    squareSizes[i * 2 + 1]
                );
                this.glContext.setUniform(`u_squareRotation[${i}]`, '1f',
                    squareRotations[i]
                );
            }

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            // Detect and draw hands
            this.handTracker.detectHands().then(hands => {
                this.handTracker.drawHands(hands);
                
                // Update grid rotations based on pinch state
                hands.forEach((hand, handIndex) => {
                    const pinchState = this.handTracker.getPinchState(handIndex);
                    if (pinchState.isActive) {
                        const handPositions = this.handTracker.getHandPositions();
                        const position = handPositions[handIndex];
                        if (position) {
                            const midX = (position.thumb.x + position.indexFinger.x) / 2;
                            const midY = (position.thumb.y + position.indexFinger.y) / 2;
                            const gridCell = this.getGridCellIndex(midX, midY);
                            if (gridCell) {
                                this.gridRotation[gridCell.row][gridCell.col] =
                                    (this.gridRotation[gridCell.row][gridCell.col] + 90) % 360;
                            }
                        }
                    }
                });
            });
        }

        requestAnimationFrame(() => this.render());
    }

    startRendering() {
        this.render();
    }
} 