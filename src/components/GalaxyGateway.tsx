const maps = [
  {
    lens: 'domain',
    focus: 'task',
    index: '01',
    title: '领域地图',
    subtitle: '问题 · 知识 · 方法',
    color: 'cyan',
  },
  {
    lens: 'ecology',
    focus: 'lerobot',
    index: '02',
    title: '生态地图',
    subtitle: '参与者 · 资源 · 成果',
    color: 'green',
  },
  {
    lens: 'cognition',
    focus: 'question',
    index: '03',
    title: '认知地图',
    subtitle: '判断 · 证据 · 学习路径',
    color: 'amber',
  },
];

function StarCluster({ seed }: { seed: number }) {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const stars = Array.from({ length: 420 }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const density = Math.pow(random(), 1.85);
    const x = 200 + Math.cos(angle) * density * 168;
    const y = 140 + Math.sin(angle) * density * 94;
    const size = .42 + (1 - density) * .82 + random() * .35;
    const opacity = .2 + (1 - density) * .7 + random() * .1;
    return <circle key={index} cx={x.toFixed(2)} cy={y.toFixed(2)} r={size.toFixed(2)} opacity={opacity.toFixed(2)} />;
  });

  return (
    <svg className="gateway-star-cluster" viewBox="0 0 400 280" aria-hidden="true">
      <defs>
        <radialGradient id={`cluster-glow-${seed}`}>
          <stop stopColor="var(--star-color)" stopOpacity=".38" />
          <stop offset=".26" stopColor="var(--star-color)" stopOpacity=".14" />
          <stop offset="1" stopColor="var(--star-color)" stopOpacity="0" />
        </radialGradient>
        <filter id={`cluster-star-glow-${seed}`} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <ellipse cx="200" cy="140" rx="170" ry="97" fill={`url(#cluster-glow-${seed})`} />
      <g fill="var(--star-color)">{stars}</g>
      <g className="gateway-bright-stars" fill="#fff" filter={`url(#cluster-star-glow-${seed})`}>
        <circle cx="191" cy="129" r="3.6" />
        <circle cx="218" cy="150" r="2.7" />
        <circle cx="175" cy="154" r="2.2" />
        <circle cx="230" cy="119" r="2" />
      </g>
      <g className="gateway-bright-stars" stroke="#f4fbff" strokeWidth=".7" opacity=".82">
        <path d="M191 121v16m-8-8h16M218 144v12m-6-6h12M175 149v10m-5-5h10" />
      </g>
    </svg>
  );
}

export default function GalaxyGateway() {
  return (
    <main className="galaxy-gateway">
      <div className="gateway-starfield" aria-hidden="true" />
      <div className="gateway-depth" aria-hidden="true" />
      <header className="gateway-header">
        <a href="/" className="gateway-brand" aria-label="光谱首页">
          <span className="brand-prism" />
          <span>光谱</span>
          <i>SPECTRUM ATLAS</i>
        </a>
        <span className="gateway-edition">具身智能 · 三张活地图</span>
      </header>

      <section className="gateway-intro">
        <p className="gateway-kicker">A LIVING UNIVERSE OF EMBODIED INTELLIGENCE</p>
        <h1>三片星海，<em>三种观察视角</em></h1>
        <p className="gateway-lede">选择一片璀璨星群，进入具身智能的一种观察视角。</p>
      </section>

      <section className="gateway-universe" aria-label="选择一片明亮星群进入地图">
        <span className="gateway-star gateway-star--one" aria-hidden="true" />
        <span className="gateway-star gateway-star--two" aria-hidden="true" />
        <span className="gateway-star gateway-star--three" aria-hidden="true" />
        <span className="gateway-star gateway-star--four" aria-hidden="true" />
        <span className="gateway-star gateway-star--five" aria-hidden="true" />
        {maps.map((map, index) => (
          <a
            key={map.lens}
            className={`gateway-map gateway-map--${map.color}`}
            href={`/map/?lens=${map.lens}&focus=${map.focus}`}
            aria-label={`进入${map.title}：${map.subtitle}`}
          >
            <StarCluster seed={index + 1} />
            <span className="gateway-map-label">
              <span className="gateway-map-index">STAR CLUSTER {map.index}</span>
              <span className="gateway-map-name">{map.title}</span>
              <span className="gateway-map-subtitle">{map.subtitle}</span>
              <span className="gateway-map-enter">进入星域 <b>↗</b></span>
            </span>
          </a>
        ))}
      </section>

      <footer className="gateway-footer">
        <span>THREE STAR CLUSTERS · ONE CONNECTED MAP</span>
        <span>领域 <b>·</b> 生态 <b>·</b> 认知</span>
      </footer>
    </main>
  );
}
