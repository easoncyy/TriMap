const glassFragmentSource = `precision highp float;
uniform mat3 orientation;
uniform vec2 viewport;
uniform sampler2D stars;
uniform vec2 beam;
uniform float energy;
uniform float reveal;
uniform float phase;
uniform vec3 tint;
uniform float attention;
varying vec2 uv;

uniform vec4 planes[4];
void cut(vec3 n, float k, vec3 ro, vec3 rd, inout float enter, inout float leave, inout vec3 face, inout vec3 exitFace) {
  float denom=dot(n,rd), gap=k-dot(n,ro);
  if(abs(denom)<.00001){if(gap<0.)enter=900.;return;}
  float t=gap/denom;
  if(denom<0.){if(t>enter){enter=t;face=n;}}
  else if(t<leave){leave=t;exitFace=n;}
}
bool intersectGlass(vec3 ro, vec3 rd, out float a,out float b,out vec3 front,out vec3 back) {
  a=-100.; b=100.; front=vec3(0.); back=vec3(0.);
  for(int i=0;i<4;i++){
    vec3 n=planes[i].xyz; float d=planes[i].w;
    cut(n,d,ro,rd,a,b,front,back);
    for(int j=0;j<4;j++){if(j<=i)continue;
      vec3 n2=planes[j].xyz; vec3 sum=n+n2; float l=length(sum);
      cut(sum/l,(d+planes[j].w-.018)/l,ro,rd,a,b,front,back);
    }
  }
  return a<b && b>0.;
}
// Rectangular studio windows, a dark horizon and two narrow spectral sources.
// Changes in viewing direction sample different parts of the same environment.
vec3 environment(vec3 d){
  vec3 c=mix(vec3(.035,.055,.069),vec3(.24,.34,.38),smoothstep(-.7,.96,d.y));
  float horizon=exp(-17.*abs(d.y+.17+.13*d.x));
  c+=horizon*vec3(.45,.59,.63);
  float window=smoothstep(.67,.76,dot(d,normalize(vec3(-.66,.73,.2))));
  c+=window*(.62+.38*smoothstep(-.1,.21,d.z))*vec3(1.16,1.25,1.28);
  float strip=exp(-27.*abs(d.x+.42*d.y-.35))*smoothstep(-.58,.28,d.y);
  c+=strip*vec3(1.3,1.05,.74);
  c+=exp(-45.*abs(d.z+.36*d.y+.47))*vec3(.67,.91,1.);
  return c;
}
void main(){
  vec3 eye=vec3(0.,0.,4.5);
  vec3 ray=normalize(vec3(uv*1.25,-4.5));
  vec3 origin=eye*orientation, dir=ray*orientation;
  float a,b;vec3 face,back;
  if(!intersectGlass(origin,dir,a,b,face,back))discard;
  vec3 p=origin+a*dir, normal=orientation*face;
  vec3 light=normalize(vec3(beam.x,beam.y, .74));
  float incidence=max(0.,dot(normal,light));
  vec3 inside=refract(dir,face,1./1.52);
  vec3 o=p+inside*.001, n0, n1;
  float start,stop;
  intersectGlass(o,inside,start,stop,n0,n1);
  vec3 exitRay=refract(inside,-n1,1.52);
  vec3 exitPos=o+stop*inside;
  vec3 exitNormal=n1;
  if(dot(exitRay,exitRay)<.01){
    vec3 bounced=reflect(inside,-n1);
    intersectGlass(exitPos+bounced*.001,bounced,start,stop,n0,n1);
    exitRay=refract(bounced,-n1,1.52);
    if(dot(exitRay,exitRay)<.01)exitRay=reflect(bounced,-n1);
  }
  vec3 outgoing=orientation*exitRay;
  // A pale face reflects the broad overhead window. The turn into
  // the shadow face is sharp. The night sky is transmitted through both.
  vec2 screen=gl_FragCoord.xy/viewport;
  vec2 offset=(outgoing.xy-ray.xy)*.048 + normal.xy*.017;
  vec3 sky=texture2D(stars,clamp(screen+offset,.002,.998)).rgb;
  vec3 reflected=environment(reflect(ray,normal));
  vec3 transmitted=environment(outgoing);
  float incidenceView=clamp(dot(normal,-ray),0.,1.);
  float fresnel=.04+.42*pow(1.-incidenceView,3.);
  float window=max(0., dot(normal,normalize(vec3(-.76,.49,.41))));
  vec3 col=mix(sky*1.12,transmitted*mix(tint,vec3(.77,.86,.90),.62),.27);
  col=mix(col,reflected*vec3(.85,.93,.96),fresnel+.13);
  col+=vec3(.12,.17,.20)*window*window;
  // The two sides of the aperture cut a broad reflected band through the back face.
  float aperture=dot(exitPos,vec3(.34,.91,-.43));
  float ribbon=smoothstep(-.34,-.32,aperture)*(1.-smoothstep(-.32,-.02,aperture));
  col+=vec3(.12,.17,.19)*ribbon*(.35+.65*window);
  col*=.74+.26*smoothstep(-.7,.75,p.y);
  // A ghost image of the back bevel sits *inside* the clear face.
  float rim=2., innerRim=2.;
  for(int i=0;i<4;i++){
    vec4 plane=planes[i];
    if(dot(face,plane.xyz)<.985)rim=min(rim,abs(plane.w-dot(plane.xyz,p)));
    if(dot(exitNormal,plane.xyz)<.985)innerRim=min(innerRim,abs(plane.w-dot(plane.xyz,exitPos)));
  }
  col+=vec3(.24,.30,.31)*exp(-52.*innerRim)*(.55+.45*incidenceView);
  // A feathered strip light has one crisp shutter edge, visible on the lit face.
  float sweep=p.y-.49*p.x+.30*p.z;
  float satin=smoothstep(-.38,-.34,sweep)*(1.-smoothstep(-.34,.25,sweep));
  col+=vec3(.40,.42,.40)*satin*(.13+.87*window);
  float edge=1.-smoothstep(.012,.051,rim);
  float bevelLight=.28+.62*window+.29*smoothstep(-.5,1.,p.y);
  col+=vec3(.13,.18,.20)*edge*bevelLight*incidence;
  // The moving mirror grazes the receiving bevel with a champagne glint.
  float rake=dot(p,normalize(vec3(beam.x*.71,beam.y*.71,.64)))-.03;
  float glint=exp(-38.*abs(rake));
  float movingLight=sin(phase*.42+normal.x*1.7)*.81;
  float crossing=exp(-13.*abs(sweep-movingLight));
  col+=crossing*(.15+.39*window+edge*.46)*mix(vec3(.65,.83,.96),vec3(1.,.83,.61),window);
  col+=sky*(.19+.36*edge);
  col+=energy*incidence*(.38*glint+.08*edge+.045)*vec3(1.,.81,.59);
  // Integrate luminous strands along the refracted ray inside the tetrahedron.
  // Their apparent direction and brightness change with the thickness of each facet.
  vec3 chord=exitPos-p;
  float glow=0.;
  for(int i=0;i<5;i++){
    vec3 q=p+chord*((float(i)+.5)/5.);
    float wave=q.y+.48*q.x-.28*q.z-.22*sin(3.7*q.x+2.6*q.z+phase);
    float band=wave-.30*sin(phase*.72+q.z*2.);
    glow+=exp(-19.*abs(band))+.24*exp(-10.*abs(band-.18));
  }
  float depth=min(length(chord),1.5);
  vec3 core=mix(tint,vec3(1.,.64,.32),attention*.68);
  col+=core*glow*.47*depth*(.8+attention*2.);
  // A narrow caustic crosses the middle of the optical path. Each facet
  // refracts a different portion of the same travelling filament.
  vec3 middle=orientation*(p+chord*.46);
  float crest=middle.y-.43*middle.x-.18*sin(3.2*middle.x+phase*1.3)-.32*sin(phase);
  float vein=exp(-26.*abs(crest));
  float bloom=exp(-6.*abs(crest));
  float pulse=.24+.76*exp(-3.*abs(middle.x-.47*sin(phase*.84)));
  vec3 spectral=mix(tint*vec3(.80,1.12,1.28),vec3(1.55,.69,.24),attention*.70);
  col+=spectral*(vein*1.65+bloom*.34)*pulse*(.55+attention)*smoothstep(.04,.55,depth);
  col+=tint*depth*.07*(.5+.5*incidence);
  col+=vec3(1.,.81,.55)*attention*(.26*glint+.13*incidence);
  vec3 dust=texture2D(stars,screen).rgb;
  float density=smoothstep(.045,.30,dot(dust,vec3(.24,.65,.11)));
  float filament=.5+.5*sin(screen.x*18.+screen.y*27.+phase*.17+2.*sin(screen.y*9.));
  float veil=density*(.13+.23*filament);
  vec3 glass=mix(1.-exp(-1.67*col),dust*1.32,veil);
  float coverage=smoothstep(.003,.13,b-a);
  gl_FragColor=vec4(glass,(.87-.17*density-.16*edge+.06*attention)*coverage*reveal);
}
`;

export function createPrismSurface(canvas, invalidate) {
  const sky=document.createElement('canvas');
  let hasSky=false,disposed=false;
  const images=['sky','nebula-far','nebula-near'].map(name=>{
    const image=new Image();image.src='/optical/'+name+'.webp';return image;
  });
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    powerPreference: 'low-power',
  });
  let program,
    locations,
    texture,
    buffer;
  const poses = new Map();
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const unit = (a) => {
    const d = Math.hypot(...a) || 1;
    return a.map((v) => v / d);
  };
  // One optical solid feeds both renderers. Plane offsets are measured
  // from the origin inside the stone, so each normal points outwards.
  const vertices = [[-.08,1.10,.02],[-.93,-.62,-.49],[.93,-.62,-.49],[0,-.62,1.03]];
  const faces = [[1,2,3],[0,2,3],[0,3,1],[0,1,2]];
  const planes = faces.map(([first,second,third]) => {
    const a = vertices[first];
    const u = vertices[second].map((v,i)=>v-a[i]);
    const v = vertices[third].map((n,i)=>n-a[i]);
    let normal = unit([u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]);
    if (dot(normal,a)<0) normal=normal.map(n=>-n);
    return [...normal,dot(normal,a)];
  });
  function orientation(id) {
    if (poses.has(id)) return poses.get(id);
    let hash = 0;
    for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    const yaw = -0.16 + (hash % 27) / 100,
      pitch = 0.25 + ((hash >>> 5) % 17) / 100,
      roll = -0.025 + ((hash >>> 9) % 12) / 100;
    const rotate = ([x, y, z]) => {
      const u = x * Math.cos(yaw) + z * Math.sin(yaw),
        v = z * Math.cos(yaw) - x * Math.sin(yaw);
      const h = y * Math.cos(pitch) - v * Math.sin(pitch),
        k = v * Math.cos(pitch) + y * Math.sin(pitch);
      return [
        u * Math.cos(roll) - h * Math.sin(roll),
        u * Math.sin(roll) + h * Math.cos(roll),
        k,
      ];
    };
    const axes = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ].map(rotate);
    const pose = { rotate, matrix: new Float32Array(axes.flat()) };
    poses.set(id, pose);
    return pose;
  }
  function setup() {
    if (!gl) return false;
    const shaders = [];
    for (const [type, text] of [
      [
        gl.VERTEX_SHADER,
        'attribute vec2 pos;varying vec2 uv;void main(){uv=pos;gl_Position=vec4(pos,0.,1.);}',
      ],
      [gl.FRAGMENT_SHADER, glassFragmentSource],
    ]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return false;
      shaders.push(shader);
    }
    const p = gl.createProgram();
    shaders.forEach((s) => gl.attachShader(p, s));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return false;
    gl.useProgram(p);
    const buf = gl.createBuffer();
    buffer = buf;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const xy = gl.getAttribLocation(p, 'pos');
    gl.enableVertexAttribArray(xy);
    gl.vertexAttribPointer(xy, 2, gl.FLOAT, false, 0, 0);
    locations = Object.fromEntries(
      ['orientation', 'beam', 'energy', 'reveal', 'viewport', 'stars','phase','tint','attention'].map(
        (k) => [k, gl.getUniformLocation(p, k)],
      ),
    );
    gl.uniform4fv(gl.getUniformLocation(p,'planes[0]'), new Float32Array(planes.flat()));
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    for (const edge of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
      gl.texParameteri(gl.TEXTURE_2D, edge, gl.CLAMP_TO_EDGE);
    for (const filter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
      gl.texParameteri(gl.TEXTURE_2D, filter, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.uniform1i(locations.stars, 0);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([11,18,23,255]));
    shaders.forEach(shader=>gl.deleteShader(shader));
    if (hasSky) uploadSky();
    program = p;

    return true;
  }

  function uploadSky() {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,sky);
  }
  let previousPaint='';
  function onImage() { if(program) { uploadSky(); previousPaint=''; invalidate(); } }
  function onLost(event) {
    event.preventDefault();
    program = null;
    canvas.parentElement?.classList.remove('has-smoke');
  }
  function onRestored() { previousPaint='';setup(); invalidate(); }
  setup();
  Promise.all(images.map(image=>image.decode())).then(()=>{
    if(disposed||!gl)return;
    sky.width=480;sky.height=228;
    const ctx=sky.getContext('2d');
    if(!ctx)return;
    images.forEach((image,i)=>{ctx.globalAlpha=i===0?1:.8;ctx.drawImage(image,0,0,sky.width,sky.height);});
    hasSky=true;onImage();
  }).catch(()=>{});
  canvas.addEventListener('webglcontextlost',onLost);
  canvas.addEventListener('webglcontextrestored',onRestored);
  const pigments={domain:[.36,.80,1.],ecology:[.38,.96,.66],cognition:[1.,.60,.36]};
  const host=canvas.parentElement;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let scene=null,hovered=null,frame=0,lastFrame=0,phase=0;
  function paint() {
    if(!program||!scene)return;
    const {width,height,ratio,stones}=scene;
    const w=Math.round(width*ratio), h=Math.round(height*ratio);
    if(canvas.width!==w || canvas.height!==h) { canvas.width=w; canvas.height=h; }
    gl.uniform2f(locations.viewport,w,h);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(locations.reveal,1);

    for (const stone of stones) {
      const {id,x,y,span,light,energy}=stone;
      gl.viewport(Math.round(x*ratio),Math.round((height-y-span)*ratio),Math.round(span*ratio),Math.round(span*ratio));
      const pose=orientation(id);
      gl.uniformMatrix3fv(locations.orientation,false,pose.matrix);
      const length=Math.hypot(light.x,light.y)||1;
      gl.uniform2f(locations.beam,light.x/length,light.y/length);
      const attention=id===hovered?1:stone.focused?.42:0;
      gl.uniform1f(locations.phase,phase+pose.matrix[2]*18.);
      gl.uniform3fv(locations.tint,pigments[stone.lens]||pigments.domain);
      gl.uniform1f(locations.attention,attention);
      gl.uniform1f(locations.energy,energy);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
    if(!host.classList.contains('has-smoke'))host.classList.add('has-smoke');
  }
  function tick(now){
    frame=0;
    if(!lastFrame||now-lastFrame>=1000/24-1){
      phase+=lastFrame?Math.min(now-lastFrame,100)*.0011:0;
      lastFrame=now;
      paint();
    }
    frame=requestAnimationFrame(tick);
  }
  function syncMotion(){
    const enabled=program&&scene?.stones.length&&!document.hidden&&!reduced.matches&&host.dataset.skyPaused!=='true'
      &&!host.matches('.camera-travel,.dragging-object')&&!document.querySelector('dialog[open]');
    if(enabled&&!frame)frame=requestAnimationFrame(tick);
    if(!enabled&&frame){cancelAnimationFrame(frame);frame=0;lastFrame=0;}
  }
  const stateObserver=new MutationObserver(syncMotion);
  stateObserver.observe(host,{attributes:true,attributeFilter:['data-sky-paused','class']});
  stateObserver.observe(document.body,{attributes:true,subtree:true,attributeFilter:['open']});
  reduced.addEventListener('change',syncMotion);
  document.addEventListener('visibilitychange',syncMotion);
  function draw(width,height,stones){
    if(!program||!width||!height)return;
    const ratio=Math.min(window.devicePixelRatio||1,stones.length>14?1:1.5);
    const signature=JSON.stringify([width,height,ratio,stones]);
    if(signature===previousPaint)return;
    previousPaint=signature;
    scene={width,height,ratio,stones:stones.filter(({x,y,span})=>x+span>=0&&y+span>=0&&x<=width&&y<=height)};
    paint();syncMotion();
  }
  function illuminate(id){
    if(hovered===id)return;
    hovered=id;
    if(!host.matches('.camera-travel,.dragging-object'))paint();
  }
  function dispose() {
    stateObserver.disconnect();cancelAnimationFrame(frame);
    reduced.removeEventListener('change',syncMotion);
    document.removeEventListener('visibilitychange',syncMotion);
    disposed=true;
    canvas.removeEventListener('webglcontextlost',onLost);
    canvas.removeEventListener('webglcontextrestored',onRestored);
    canvas.parentElement?.classList.remove('has-smoke');
    if(gl && program) { gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program); }
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return {draw,illuminate,dispose};
}
