export interface Stone {id:string; x:number; y:number; span:number; light:{x:number;y:number}; energy:number; lens?:string; focused:boolean}
export function createPrismSurface(canvas:HTMLCanvasElement,invalidate:()=>void):{draw:(width:number,height:number,stones:Stone[])=>void;illuminate:(id:string|null)=>void;dispose:()=>void};
