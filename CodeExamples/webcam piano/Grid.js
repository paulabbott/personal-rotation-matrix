class Grid {
  /////////////////////////////////
  constructor(_w, _h) {
    this.gridWidth = _w;
    this.gridHeight = _h;
    this.noteSize = 40;
    this.notePos = [];
    this.noteState = [];

    // initalise grid structure and state
    for (let x=0;x<_w;x+=this.noteSize){
      let posColumn = [];
      let stateColumn = [];
      for (let y=0;y<_h;y+=this.noteSize){
        posColumn.push(createVector(x+this.noteSize/2,y+this.noteSize/2));
        stateColumn.push(0);
      }
      this.notePos.push(posColumn);
      this.noteState.push(stateColumn);
    }
  }
  /////////////////////////////////
  run(img) {
    img.loadPixels();
    this.findActiveNotes(img);
    this.drawActiveNotes(img);
  }
  /////////////////////////////////
  drawActiveNotes(img){
    // draw active notes
    fill(255);
    noStroke();
    for (let i=0;i<this.notePos.length;i++){
      for (let j=0;j<this.notePos[i].length;j++){
        let x = this.notePos[i][j].x;
        let y = this.notePos[i][j].y;
        if (this.noteState[i][j]>0) {
          let alpha = this.noteState[i][j] * 200;
          let c1 = color(255,0,0,alpha);
          let c2 = color(0,255,0,alpha);
          let mix = lerpColor(c1, c2, map(i, 0, this.notePos.length, 0, 1));
          fill(mix);
          let s = this.noteState[i][j];
          ellipse(x, y, this.noteSize*s, this.noteSize*s);
        }
        this.noteState[i][j]-=0.05;
        this.noteState[i][j]=constrain(this.noteState[i][j],0,1);
      }
    }
  }
  /////////////////////////////////
  findActiveNotes(img){
    for (let x = 0; x < img.width; x += 1) {
        for (let y = 0; y < img.height; y += 1) {
            let index = (x + (y * img.width)) * 4;
            let state = img.pixels[index + 0];
            if (state==0){ // if pixel is black (ie there is movement)
              // find which note to activate
              let screenX = map(x, 0, img.width, 0, this.gridWidth);
              let screenY = map(y, 0, img.height, 0, this.gridHeight);
              let i = int(screenX/this.noteSize);
              let j = int(screenY/this.noteSize);
              this.noteState[i][j] = 1;
            }
        }
    }
  }
}
