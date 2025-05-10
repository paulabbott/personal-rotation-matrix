export class GridManager {
    constructor(gridCanvas, shaderOverlayCanvas, gridSize = 4) {
        this.gridCanvas = gridCanvas;
        this.shaderOverlayCanvas = shaderOverlayCanvas;
        this.ctx = gridCanvas.getContext('2d');
        this.shaderCtx = shaderOverlayCanvas.getContext('2d');
        this.gridSize = gridSize;
        this.squareSize = 0;
        this.padding = 1;

        // Grid state
        this.gridRotation = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
        this.cumulativeRotation = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
        this.flashTimers = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
    }

    setup() {
        this.updateCanvasSizes();
    }

    updateCanvasSizes() {
        // Calculate square size based on grid
        const totalPadding = this.padding * (this.gridSize + 1);
        const availableWidth = this.gridCanvas.width - totalPadding;
        const availableHeight = this.gridCanvas.height - totalPadding;
        this.squareSize = Math.min(
            availableWidth / this.gridSize,
            availableHeight / this.gridSize
        );
    }

    drawGrid() {
        // Draw on left overlay
        this.ctx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
        this.ctx.globalAlpha = 0.25; // Set 25% opacity

        // Calculate total grid width and horizontal centering offset
        const totalGridWidth = (this.squareSize * this.gridSize) + (this.padding * (this.gridSize - 1));
        const horizontalOffset = (this.gridCanvas.width - totalGridWidth) / 2;

        // Draw grid of squares on left overlay
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                // Mirror the x coordinate
                const mirroredCol = this.gridSize - 1 - col;
                const x = horizontalOffset + this.padding + mirroredCol * (this.squareSize + this.padding);
                const y = this.padding + row * (this.squareSize + this.padding);

                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(x, y, this.squareSize, this.squareSize);
            }
        }

        // Reset opacity
        this.ctx.globalAlpha = 1.0;

        // Draw on right overlay
        this.shaderCtx.clearRect(0, 0, this.shaderOverlayCanvas.width, this.shaderOverlayCanvas.height);
        this.shaderCtx.globalAlpha = 0.25; // Set 25% opacity

        // Draw grid of squares on right overlay
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const x = horizontalOffset + this.padding + col * (this.squareSize + this.padding);
                const y = this.padding + row * (this.squareSize + this.padding);

                this.shaderCtx.strokeStyle = 'white';
                this.shaderCtx.lineWidth = 1;
                this.shaderCtx.strokeRect(x, y, this.squareSize, this.squareSize);
            }
        }

        // Reset opacity
        this.shaderCtx.globalAlpha = 1.0;
    }

    getGridCellIndex(x, y) {
        const totalGridWidth = (this.squareSize * this.gridSize) + (this.padding * (this.gridSize - 1));
        const horizontalOffset = (this.gridCanvas.width - totalGridWidth) / 2;

        // Convert screen coordinates to grid coordinates
        const gridX = Math.floor((x - horizontalOffset - this.padding) / (this.squareSize + this.padding));
        const gridY = Math.floor((y - this.padding) / (this.squareSize + this.padding));

        // Mirror the x coordinate
        const mirroredGridX = this.gridSize - 1 - gridX;

        // Return null if outside grid
        if (mirroredGridX < 0 || mirroredGridX >= this.gridSize || gridY < 0 || gridY >= this.gridSize) {
            return null;
        }

        return { row: gridY, col: mirroredGridX };
    }

    rotateCell(row, col, angle = 5, clockwise = true) {
        if (row >= 0 && row < this.gridSize && col >= 0 && col < this.gridSize) {
            // Convert angle to radians and add to current rotation
            const angleInRadians = angle * (Math.PI / 180);
            // If clockwise is false, negate the angle to rotate counter-clockwise
            this.gridRotation[row][col] += clockwise ? -angleInRadians : angleInRadians;
            // Update cumulative rotation (always positive)
            this.cumulativeRotation[row][col] += Math.abs(angleInRadians);
            // console.log(`Rotation: ${this.gridRotation[row][col]}, Cumulative: ${this.cumulativeRotation[row][col]}`);
            return true;
        }
        return false;
    }

    getCellRotation(row, col) {
        if (row >= 0 && row < this.gridSize && col >= 0 && col < this.gridSize) {
            return this.gridRotation[row][col];
        }
        return 0;
    }

    getGridData() {
        const squarePositions = [];
        const squareSizes = [];
        const squareRotations = [];
        const squareCumulativeRotations = [];

        // Calculate total grid width and horizontal centering offset
        const totalGridWidth = (this.squareSize * this.gridSize) + (this.padding * (this.gridSize - 1));
        const horizontalOffset = (this.gridCanvas.width - totalGridWidth) / 2;

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const x = (horizontalOffset + this.padding + col * (this.squareSize + this.padding)) / this.gridCanvas.width;
                const y = (this.padding + row * (this.squareSize + this.padding)) / this.gridCanvas.height;
                const width = this.squareSize / this.gridCanvas.width;
                const height = this.squareSize / this.gridCanvas.height;

                squarePositions.push(x, y);
                squareSizes.push(width, height);
                squareRotations.push(this.gridRotation[row][col]);
                squareCumulativeRotations.push(this.cumulativeRotation[row][col]);
            }
        }

        return {
            positions: squarePositions,
            sizes: squareSizes,
            rotations: squareRotations,
            cumulativeRotations: squareCumulativeRotations
        };
    }
} 