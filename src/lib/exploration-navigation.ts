/** Ephemeral camera state; never stored in the knowledge model. */
export type Camera = {x:number;y:number;zoom:number};
export type CameraSnapshot = {viewport:Camera;width:number;height:number};
export type RevealRequest = {id:string;epoch:number;restore?:CameraSnapshot};
type Rect = {x:number;y:number;width:number;height:number};

export function restoreCamera(snapshot:CameraSnapshot,width:number,height:number):Camera {
 return {...snapshot.viewport,x:snapshot.viewport.x+(width-snapshot.width)/2,y:snapshot.viewport.y+(height-snapshot.height)/2};
}

/** Keep a readable scale and room for the screen-sized label. No move if already safe. */
export function locateCamera(current:Camera,object:Rect,safe:Rect,preserveScale=false):Camera {
 const fit=Math.min((safe.width-24)/object.width,(safe.height-76)/object.height);
 const zoom=Math.max(.02,Math.min(preserveScale?current.zoom:Math.max(.65,current.zoom),Math.max(.02,fit)));
 const cx=object.x+object.width/2,cy=object.y+object.height/2;
 const halfWidth=Math.max(object.width*zoom/2,Math.min(104,safe.width/2-4));
 const top=object.height*zoom/2+8,bottom=object.height*zoom/2+64;
 const px=cx*zoom+current.x,py=cy*zoom+current.y;
 if(zoom===current.zoom&&px-halfWidth>=safe.x&&px+halfWidth<=safe.x+safe.width&&py-top>=safe.y&&py+bottom<=safe.y+safe.height)return current;
 return {zoom,x:safe.x+safe.width/2-cx*zoom,y:safe.y+(safe.height+top-bottom)/2-cy*zoom};
}
