class HandTracker {
    constructor(videoElement, leftHandCanvas, rightHandCanvas) {
        this.video = videoElement;
        this.leftHandCanvas = leftHandCanvas;
        this.rightHandCanvas = rightHandCanvas;
        this.leftCtx = leftHandCanvas.getContext('2d');
        this.rightCtx = rightHandCanvas.getContext('2d');
        
        // Hand tracking properties
        this.detector = null;
        this.offscreen = document.createElement('canvas');
        this.offctx = this.offscreen.getContext('2d');
        this.offscreen.width = OFF_W;
        this.offscreen.height = OFF_H;
        this.hands = [];
        this.frameCount = 0;

        // Pinch detection state
        this.zOffset = [0, 0]; // Raw z-offset values for each hand
        this.pinchDist = [0, 0]; // Raw pinch distance values for each hand
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
        // Clear both canvases
        this.leftCtx.clearRect(0, 0, this.leftHandCanvas.width, this.leftHandCanvas.height);
        this.rightCtx.clearRect(0, 0, this.rightHandCanvas.width, this.rightHandCanvas.height);

        if (!hands || hands.length === 0) return;

        const sx = this.leftHandCanvas.width / OFF_W;
        const sy = this.leftHandCanvas.height / OFF_H;

        hands.forEach((hand, handIndex) => {
            // Get thumb and index finger positions
            const thumb = hand.keypoints[4];
            const indexFinger = hand.keypoints[8];

            // Get raw values for visualization
            const zOffset = this.zOffset[handIndex];
            const pinchDist = this.pinchDist[handIndex];
            const pinchThreshold = zOffset / Z_OFFSET_SCALE;

            // Calculate everything in offscreen coordinates first
            const midX = (thumb.x + indexFinger.x) / 2;
            const midY = (thumb.y + indexFinger.y) / 2;

            // Draw on both canvases
            [this.leftCtx, this.rightCtx].forEach(ctx => {
                // Draw line between thumb and index finger
                ctx.beginPath();
                ctx.moveTo(thumb.x * sx, thumb.y * sy);
                ctx.lineTo(indexFinger.x * sx, indexFinger.y * sy);
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Calculate line length for circle diameter
                const lineLength = Math.sqrt(
                    Math.pow((indexFinger.x - thumb.x) * sx, 2) + 
                    Math.pow((indexFinger.y - thumb.y) * sy, 2)
                );

                // Draw circle with diameter equal to line length
                ctx.beginPath();
                ctx.arc(midX * sx, midY * sy, lineLength / 2, 0, 2 * Math.PI);
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Draw circle with diameter equal to zOffset
                ctx.beginPath();
                ctx.arc(midX * sx, midY * sy, zOffset, 0, 2 * Math.PI);
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Draw dot at midpoint, yellow if pinching, size scaled by zOffset
                const dotSize = zOffset / 5; // Scale factor to make dot visible but not too large
                ctx.beginPath();
                ctx.arc(midX * sx, midY * sy, dotSize, 0, 2 * Math.PI);
                ctx.fillStyle = this.pinchActive[handIndex] ? 'yellow' : 'black';
                ctx.fill();
            });

            // Display raw values
            this.leftCtx.fillStyle = 'black';
            this.leftCtx.fillRect(5, 5, 400, 30); // Add black background
            this.leftCtx.fillStyle = 'white';
            this.leftCtx.font = '16px Arial';
            if (handIndex === 0) { // Left hand
                this.leftCtx.fillText(`zOffset: ${Math.round(zOffset)} | pinchDist: ${Math.round(pinchDist)} | threshold: ${Math.round(pinchThreshold)}`, 10, 20);
            } else if (handIndex === 1) { // Right hand
                this.leftCtx.fillRect(this.leftHandCanvas.width - 405, 5, 400, 30); // Add black background
                this.leftCtx.fillText(`zOffset: ${Math.round(zOffset)} | pinchDist: ${Math.round(pinchDist)} | threshold: ${Math.round(pinchThreshold)}`, this.leftHandCanvas.width - 300, 20);
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
                this.zOffset[handIndex] = calculateZOffset(hand);

                // Calculate and update pinch distance
                this.pinchDist[handIndex] = calculatePinchDistance(hand);

                // Calculate pinch threshold based on z-offset
                const pinchThreshold = this.zOffset[handIndex] / Z_OFFSET_SCALE;

                // Check for pinch
                if (this.pinchDist[handIndex] < pinchThreshold) {
                    const currentTime = Date.now();
                    
                    if (!this.pinchActive[handIndex] && (currentTime - this.lastPinchTime[handIndex] > DEBOUNCE_TIME)) {
                        // Set pinch as active and update time
                        this.pinchActive[handIndex] = true;
                        this.lastPinchTime[handIndex] = currentTime;
                    }
                } else {
                    // Reset pinch state when pinch is released
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
            const sx = this.leftHandCanvas.width / OFF_W;
            const sy = this.leftHandCanvas.height / OFF_H;
            return {
                thumb: { x: thumb.x * sx, y: thumb.y * sy },
                indexFinger: { x: indexFinger.x * sx, y: indexFinger.y * sy }
            };
        });
    }
} 