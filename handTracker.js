class HandTracker {
    constructor(videoElement, overlayCanvas) {
        this.video = videoElement;
        this.overlayCanvas = overlayCanvas;
        this.ctx = overlayCanvas.getContext('2d');
        
        // Hand tracking properties
        this.detector = null;
        this.offscreen = document.createElement('canvas');
        this.offctx = this.offscreen.getContext('2d');
        this.offscreen.width = OFF_W;
        this.offscreen.height = OFF_H;
        this.hands = [];
        this.frameCount = 0;

        // Pinch detection state
        this.zOffsetBuffers = [[], []]; // Buffers for smoothing zOffset values
        this.pinchDistBuffers = [[], []]; // Buffers for smoothing pinchDist values
        this.pinchActive = [false, false]; // Track pinch state for each hand
        this.lastPinchTime = [0, 0]; // Track the last pinch time for each hand
        this.lastPinchCell = [null, null]; // Track the last cell where pinch occurred
    }

    async setup() {
        try {
            await setupBackend();
            this.detector = await createDetector();
            console.log('Hand tracking initialized');
        } catch (error) {
            console.error('Error setting up hand tracking:', error);
        }
    }

    drawHands(hands) {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        if (!hands || hands.length === 0) return;

        const sx = this.overlayCanvas.width / OFF_W;
        const sy = this.overlayCanvas.height / OFF_H;

        hands.forEach((hand, handIndex) => {
            // Get thumb and index finger positions
            const thumb = hand.keypoints[4];
            const indexFinger = hand.keypoints[8];

            // Get smoothed values for visualization
            const smoothedZOffset = getSmoothedValue(this.zOffsetBuffers[handIndex]);
            const smoothedPinchDist = getSmoothedValue(this.pinchDistBuffers[handIndex]);
            const pinchThreshold = smoothedZOffset / Z_OFFSET_SCALE;

            // Calculate everything in offscreen coordinates first
            const midX = (thumb.x + indexFinger.x) / 2;
            const midY = (thumb.y + indexFinger.y) / 2;

            // Draw line between thumb and index finger
            this.ctx.beginPath();
            this.ctx.moveTo(thumb.x * sx, thumb.y * sy);
            this.ctx.lineTo(indexFinger.x * sx, indexFinger.y * sy);
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Calculate line length for circle diameter
            const lineLength = Math.sqrt(
                Math.pow((indexFinger.x - thumb.x) * sx, 2) + 
                Math.pow((indexFinger.y - thumb.y) * sy, 2)
            );

            // Draw circle with diameter equal to line length
            this.ctx.beginPath();
            this.ctx.arc(midX * sx, midY * sy, lineLength / 2, 0, 2 * Math.PI);
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            // Draw circle with diameter equal to line smoothedZOffset
            this.ctx.beginPath();
            this.ctx.arc(midX * sx, midY * sy, smoothedZOffset, 0, 2 * Math.PI);
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            // Draw dot at midpoint, yellow if pinching, size scaled by zOffset
            const dotSize = smoothedZOffset / 5; // Scale factor to make dot visible but not too large
            this.ctx.beginPath();
            this.ctx.arc(midX * sx, midY * sy, dotSize, 0, 2 * Math.PI);
            this.ctx.fillStyle = this.pinchActive[handIndex] ? 'yellow' : 'black';
            this.ctx.fill();

            // Display smoothed zOffset and pinchDist values
            this.ctx.fillStyle = 'black';
            this.ctx.fillRect(5, 5, 400, 30); // Add black background
            this.ctx.fillStyle = 'white';
            this.ctx.font = '16px Arial';
            if (handIndex === 0) { // Left hand
                this.ctx.fillText(`zOffset: ${Math.round(smoothedZOffset)} | pinchDist: ${Math.round(smoothedPinchDist)} | threshold: ${Math.round(pinchThreshold)}`, 10, 20);
            } else if (handIndex === 1) { // Right hand
                this.ctx.fillRect(this.overlayCanvas.width - 405, 5, 400, 30); // Add black background
                this.ctx.fillText(`zOffset: ${Math.round(smoothedZOffset)} | pinchDist: ${Math.round(smoothedPinchDist)} | threshold: ${Math.round(pinchThreshold)}`, this.overlayCanvas.width - 300, 20);
            }
        });
    }

    async detectHands() {
        if (!this.detector) return;

        // Only process every DETECTION_INTERVAL frames
        this.frameCount++;
        if (this.frameCount % DETECTION_INTERVAL !== 0) return;

        // Draw video to offscreen canvas with lower quality for better performance
        this.offctx.imageSmoothingEnabled = false;
        this.offctx.drawImage(this.video, 0, 0, OFF_W, OFF_H);

        // Detect hands
        try {
            this.hands = await this.detector.estimateHands(this.offscreen, {
                flipHorizontal: true
            });

            // Process each detected hand
            this.hands.forEach((hand, handIndex) => {
                // Calculate and update z-offset
                const zOffset = calculateZOffset(hand);
                updateBuffer(this.zOffsetBuffers[handIndex], zOffset);

                // Calculate and update pinch distance
                const pinchDist = calculatePinchDistance(hand);
                updateBuffer(this.pinchDistBuffers[handIndex], pinchDist);

                // Get smoothed values
                const smoothedZOffset = getSmoothedValue(this.zOffsetBuffers[handIndex]);
                const smoothedPinchDist = getSmoothedValue(this.pinchDistBuffers[handIndex]);

                // Calculate pinch threshold based on z-offset
                const pinchThreshold = smoothedZOffset / Z_OFFSET_SCALE;

                // Check for pinch
                if (smoothedPinchDist < pinchThreshold) {
                    const currentTime = Date.now();
                    
                    if (!this.pinchActive[handIndex] && (currentTime - this.lastPinchTime[handIndex] > DEBOUNCE_TIME)) {
                        // Set pinch as active and update time
                        this.pinchActive[handIndex] = true;
                        this.lastPinchTime[handIndex] = currentTime;
                        console.log('Pinch activated for hand:', handIndex);
                    }
                } else {
                    // Reset pinch state when pinch is released
                    if (this.pinchActive[handIndex]) {
                        console.log('Pinch released for hand:', handIndex, {
                            reason: 'fingers moved apart',
                            smoothedPinchDist,
                            pinchThreshold
                        });
                    }
                    this.pinchActive[handIndex] = false;
                }
            });

            return this.hands;
        } catch (error) {
            console.error('Error detecting hands:', error);
            return [];
        }
    }

    // Getter for pinch state
    getPinchState(handIndex) {
        return {
            isActive: this.pinchActive[handIndex],
            lastPinchTime: this.lastPinchTime[handIndex],
            lastPinchCell: this.lastPinchCell[handIndex]
        };
    }

    // Getter for hand positions
    getHandPositions() {
        return this.hands.map(hand => {
            if (!hand || !hand.keypoints) return null;
            const thumb = hand.keypoints[4];
            const indexFinger = hand.keypoints[8];
            const sx = this.overlayCanvas.width / OFF_W;
            const sy = this.overlayCanvas.height / OFF_H;
            return {
                thumb: { x: thumb.x * sx, y: thumb.y * sy },
                indexFinger: { x: indexFinger.x * sx, y: indexFinger.y * sy }
            };
        });
    }
} 