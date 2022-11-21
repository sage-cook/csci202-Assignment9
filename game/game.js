var circuitBoard;
var currentTool = 0;

const PIXELRATIO = Math.round(window.devicePixelRatio) || 1;

const IMGANT = (img => {img.src = 'assets/ant.png'; return img})(document.createElement('img'));
const CELLSIZE = 80;
const CELLRESOLUTION = CELLSIZE * PIXELRATIO;
const [bheight,bwidth] = [8,10];

// Initial Setup
window.addEventListener('load',function() {
	// Prevent context menus when right-clicking in the build view
	document.getElementById('build-view').addEventListener('contextmenu',function(e) {e.preventDefault()});
	// Generate the circuit board object, which allows display and manipulation of a circuit
	circuitBoard = {
		table: document.getElementById('circuit-board'),
		cells: new Array(bheight).fill(0).map(() => []),
		pathDrawerSelection: undefined,
		// Test function just to draw every cell
		drawCells: function(x1=0,y1=0,x2=bwidth,y2=bheight) {
			for(let x = x1; x < x2; x++) for(let y = y1; y < y2; y++)
			{
				this.cells[y][x].draw();
			}
		},
		cellAdj: function(c1,c2) {
			if(c2[0]==c1[0] && c2[1]==c1[1]+1) return 0;
			if(c2[0]==c1[0]-1 && c2[1]==c1[1]) return 1;
			if(c2[0]==c1[0] && c2[1]==c1[1]-1) return 2;
			if(c2[0]==c1[0]+1 && c2[1]==c1[1]) return 3;
			return undefined;
		},
		// Advances the circuitBoard by one step of simulation and flags cells for drawing
		simulate: function() {
			let ants = new Array(bheight).fill(0).map(() => new Array(bwidth).fill(0));
			let antDirs = new Array(bheight).fill(0).map(() => []);
			// populate ants and antDirs
			for(let x = 0; x < bwidth; x++) for(let y = 0; y < bheight; y++)
			{
				let c = this.cells[y][x];
				if(c.ant)
				{
					// console.log('ant found');
					for(let i = 0; i < 4; i++)
					{
						if(c.connections[i] && i != (c.antDir+2)%4)
						{
							// console.log('spreading in direction '+i);
							// spread ants
							let [dy,dx] = dirToCoord(i);
							// TODO Add tunnel functionality
							// Make sure the ants don't fall off the edge
							if(ants[y+dy] == undefined || ants[y+dy][x+dx] == undefined) continue;
							
							// Don't spread if there is another ant going the opposite direction (same as colliding)
							if(this.cells[y+dy][x+dx].ant && this.cells[y+dy][x+dx].antDir != i) continue;
							
							ants[y+dy][x+dx]++;
							antDirs[y+dy][x+dx] = i;
						}
					}
				}
			}
			// console.log(ants);
			for(let x = 0; x < bwidth; x++) for(let y = 0; y < bheight; y++)
			{
				let c = this.cells[y][x];
				let ant = ants[y][x];
				let antDir = antDirs[y][x];
				// Flag c for redrawing if current ant is not equal to ant for next step
				if(c.ant != (ant == 1) || (ant == 1 && c.antDir != antDir))
				{
					c.drawFlag = true;
				}
				// If exactly one ant has spread into this space, add an ant next step
				if(ant == 1)
				{
					c.antDir = antDir;
					c.ant = true;
				}
				else
				{
					c.ant = false;
				}
			}
		},
		drawFlagged: function() {
			for(let x = 0; x < bwidth; x++) for(let y = 0; y < bheight; y++)
			{
				if(this.cells[y][x].drawFlag)
				{
					this.cells[y][x].draw();
					this.cells[y][x].drawFlag = false;
				}
			}
		},
	};
	circuitBoard.table.style.width = CELLSIZE*bwidth+'px';
	
	// Generate the circuit cells
	for(let i=0; i<bheight; i++)
	{
		let row = document.createElement('tr');
		for(let j=0; j<bwidth; j++)
		{
			let cell = document.createElement('td');
			let canv = document.createElement('canvas');
			canv.width = CELLRESOLUTION;
			canv.height = CELLRESOLUTION;
			canv.style.width = CELLSIZE+'px';
			canv.style.height = CELLSIZE+'px';
			canv.draggable = false;
			// let ctx = canv.getContext('2d');
			// ctx.fillStyle = '#ff0000';
			// ctx.fillRect(0,0,80,80);
			circuitBoard.cells[i][j] = new CircuitCell(canv,[i,j]);
			cell.appendChild(canv);
			row.appendChild(cell);
		}
		circuitBoard.table.appendChild(row);
	}
	
	let circuitArea = document.getElementById('circuit-area');
	
	let relPathDrawer = function () {circuitBoard.pathDrawerSelection = undefined};
	circuitArea.addEventListener('mouseup',relPathDrawer);
	circuitArea.addEventListener('mouseleave',relPathDrawer);
	
	let toolButtons = document.getElementsByClassName('tool-button');
	for(let i=0; i<toolButtons.length; i++)
	{
		toolButtons[i].addEventListener('mousedown', function() {
			if(this.dataset.toolid!=undefined)
			{
				for(let j=0; j<toolButtons.length; j++) if(toolButtons[j].dataset.toolid==currentTool) {
					toolButtons[j].classList.remove('tool-active');
					break;
				}
				currentTool = Number(this.dataset.toolid);
				this.classList.add('tool-active');
			}
		});
	}
	
	let simulateButton = document.getElementById('control-button-simulate');
	simulateButton.addEventListener('mousedown', function() {
		circuitBoard.simulate();
		circuitBoard.drawFlagged();
	});
});

/**
 * A single cell in the circuit board. Contains information about connections, ants, biscuits,
 * as well as methods for drawing.
 */
class CircuitCell {
	constructor(canvas, coord, connections = [false,false,false,false], ant = false, antDir = 0, vtunnel, htunnel)
	{
		this.canvas = canvas;
		this.connections = connections;
		this.coord = coord;
		this.ant = ant;
		this.vtunnel = vtunnel;
		this.htunnel = htunnel;
		this.drawFlag = false; // Flag used to decide which cells need to be redrawn at each step of simulation.
		
		// Add interaction with cell
		this.canvas.addEventListener('mousedown',(e) => {
			let placeOrErase = (e.buttons>>1)%2 ? false : e.buttons%2 ? !e.shiftKey : undefined;
			switch(currentTool)
			{
				case 0: /* Draw Tool */
					circuitBoard.pathDrawerSelection = this.coord;
					break;
				case 1: /* Ant Tool */
					// Set to false if right button is pressed and/or shift key is held, otherwise set to true if left button is pressed and else undefined
					// right click is pressed
					if(placeOrErase && this.connections.includes(true))
					{
						if(this.ant==true)
						{
							this.antDir = (this.antDir + 1) % 4;
						}
						else
						{
							this.ant = true;
							this.antDir = 1;
						}
						
						// Adjust antDir until ant is sitting on a path connection
						while(!this.connections[(this.antDir+2)%4])
						{
							this.antDir = (this.antDir + 1) % 4;
						}
					}
					else if(placeOrErase==false)
					{
						this.ant = false;
					}
					this.draw();
					break;
				case 2: /* Vertical Tunnel */
					if(placeOrErase != undefined)
					{
						if(this.coord[0] == 0)
						{
							// this.vtunnel = 'toptunnel';// TODO
							this.up = placeOrErase;
							this.draw();
						} else if (this.coord[0] == bheight-1)
						{
							// this.vtunnel = 'bottomtunnel';// TODO
							this.down = placeOrErase;
							this.draw();
						}
					}
					break;
				case 3: /* Horizontal Tunnel */
					if(placeOrErase != undefined)
					{
						if(this.coord[1] == 0)
						{
							// this.htunnel = 'lefttunnel';// TODO
							this.left = placeOrErase;
							this.draw();
						} else if (this.coord[1] == bwidth-1)
						{
							// this.htunnel = 'righttunnel';// TODO
							this.right = placeOrErase;
							this.draw();
						}
					}
					break;
				default:
					// Biscuits
			}
		});
		this.canvas.addEventListener('mouseover',(e) => {
			if(currentTool==0 && circuitBoard.pathDrawerSelection != undefined)
			{
				// Set to false if right button is pressed and/or shift key is held, otherwise set to true if left button is pressed and else undefined
				let placeOrErase = (e.buttons>>1)%2 ? false : e.buttons%2 ? !e.shiftKey : undefined;
				let linkDir = circuitBoard.cellAdj(circuitBoard.pathDrawerSelection,this.coord);
				if(linkDir != undefined && placeOrErase != undefined)
				{
					let prevCell = circuitBoard.cells[circuitBoard.pathDrawerSelection[0]][circuitBoard.pathDrawerSelection[1]]
					prevCell.connections[linkDir] = placeOrErase;
					this.connections[(linkDir+2)%4] = placeOrErase;
					
					// Erase ants if needed
					if(placeOrErase==false)
					{
						if(prevCell.ant && (prevCell.antDir+2)%4 == linkDir) prevCell.ant = false;
						if(this.ant && this.antDir == linkDir) this.ant = false;
					}
					
					prevCell.draw();
					this.draw();
				}
				circuitBoard.pathDrawerSelection = this.coord;
			}
		});
		// this.canvas.addEventListener('onselect', (e) => {console.log('tried to drag');e.preventDefault();});
		
	}
	draw()
	{
		// Get context
		let ctx = this.canvas.getContext('2d');
		// Convenience variable for half the cell size
		let m = CELLRESOLUTION/2;
		// Clear the canvas
		ctx.clearRect(0,0,CELLRESOLUTION,CELLRESOLUTION);
		
		// Setup parameters
		ctx.lineWidth = 5*PIXELRATIO;
		ctx.lineCap = 'round';
		ctx.fillStyle = 'gray';
		// Setup context for rotation
		ctx.save();
		ctx.translate(m,m);
		// Draw connections + tunnels
		for(let i = 0; i < 4; i++)
		{
			if(this.connections[i])
			{
				ctx.beginPath();
				ctx.moveTo(0,0);
				ctx.lineTo(m,0);
				ctx.stroke();
				if(this.isBorder(i))
				{
					ctx.beginPath();
					ctx.arc(m,0,10*PIXELRATIO,0,2*Math.PI);
					ctx.fill();
					ctx.stroke();
				}
			}
			ctx.rotate(-Math.PI/2);
		}
		// Draw ant
		if(this.ant)
		{
			ctx.rotate(-this.antDir*Math.PI/2);
			ctx.drawImage(IMGANT,-30*PIXELRATIO,-17.5*PIXELRATIO,IMGANT.width/3*PIXELRATIO,IMGANT.height/3*PIXELRATIO);
		}
		ctx.restore();
	}
	
	/**
	 * Helper function to determine if there is a border in the direction 'dir' from this cell
	 */
	isBorder(dir)
	{
		switch(dir)
		{
			case 0:
				return this.coord[1] == bwidth-1;
			case 1:
				return this.coord[0] == 0;
			case 2:
				return this.coord[1] == 0;
			case 3:
				return this.coord[0] == bheight-1;
			default:
				return false;
		}
	}
	get right() {return this.connections[0]}
	set right(b) {this.connections[0]=b}
	get up() {return this.connections[1]}
	set up(b) {this.connections[1]=b}
	get left() {return this.connections[2]}
	set left(b) {this.connections[2]=b}
	get down() {return this.connections[3]}
	set down(b) {this.connections[3]=b}
};

function dirToCoord(dir)
{
	switch(dir)
	{
		case 0: return [0,1];
		case 1: return [-1,0];
		case 2: return [0,-1];
		case 3: return [1,0];
		default: return undefined;
	}
}

class CircuitData
{
	constructor (board)
	{
		
	}
}