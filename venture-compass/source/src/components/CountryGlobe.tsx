import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { Feature, Geometry } from 'geojson';
import type { GlobeMethods } from 'react-globe.gl';
import {
  BoxGeometry,
  CircleGeometry,
  Group,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  type Material,
  type Object3D,
} from 'three';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import countryTopology from 'world-atlas/countries-110m.json';
import { copy } from '../app/copy';
import type { MarketCountry } from '../app/marketCountries';
import type { Locale } from '../app/types';

const Globe = lazy(() => import('react-globe.gl'));
const DRAG_THRESHOLD_PX = 6;
const MARKET_MARKER_HIT_SIZE = 3.6;
const RADAR_RIPPLE_ALTITUDE = 0.024;
const GRATICULE_COLOR = '#778087';
const GRATICULE_OPACITY = 0.42;
const GLOBAL_PULSE_STEP_MS = 180;
const GLOBAL_PULSE_DURATION_MS = 3_600;

type CountryTopology = Topology<{
  countries: GeometryCollection<{ name?: string }>;
}>;

const atlas = countryTopology as unknown as CountryTopology;
const countryPolygons = feature(atlas, atlas.objects.countries).features;

export type CountryGlobeProps = {
  locale: Locale;
  countries: readonly MarketCountry[];
  value: string;
  onSelect(country: string): void;
  pulseSequence?: number;
};

type GlobeErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

class GlobeErrorBoundary extends Component<GlobeErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The accessible market controls remain available outside this boundary.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function isMarketCountry(point: object): point is MarketCountry {
  return 'id' in point && typeof point.id === 'string';
}

function getReducedMotionPreference() {
  return typeof window !== 'undefined'
    && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

function tuneGraticules(globe: GlobeMethods) {
  globe.scene().traverse((object: Object3D) => {
    const material = (object as Object3D & { material?: Material | Material[] }).material;
    const materials = Array.isArray(material) ? material : [material];

    materials.forEach((candidate) => {
      if (candidate?.type !== 'LineBasicMaterial') return;

      const lineMaterial = candidate as LineBasicMaterial;
      lineMaterial.color.set(GRATICULE_COLOR);
      lineMaterial.opacity = GRATICULE_OPACITY;
      lineMaterial.needsUpdate = true;
    });
  });
}

export function CountryGlobe({
  locale,
  countries,
  value,
  onSelect,
  pulseSequence,
}: CountryGlobeProps) {
  const text = copy[locale];
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const dragOrigin = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [globalPulseCount, setGlobalPulseCount] = useState<number | null>(null);
  const reduceMotion = useMemo(getReducedMotionPreference, []);
  const selectedCountry = countries.find((country) => country.id === value);
  const ringPoints = !reduceMotion
    ? globalPulseCount === null ? selectedCountry ? [selectedCountry] : [] : countries.slice(0, globalPulseCount)
    : [];
  const globeMaterial = useMemo(() => new MeshBasicMaterial({
    color: '#fafaf8',
    transparent: true,
    opacity: 0.88,
  }), []);

  const createMarketMarker = useCallback((point: object) => {
    const country = point as MarketCountry;
    const isSelected = country.id === value;
    const size = isSelected ? 1.8 : 1.25;

    const marker = new Group();
    marker.add(new Mesh(
      new CircleGeometry(size / 2, 32),
      new MeshBasicMaterial({
        color: isSelected ? '#b42320' : '#d34b45',
        transparent: true,
        opacity: isSelected ? 1 : 0.9,
        depthWrite: false,
      }),
    ));
    marker.add(new Mesh(
      new BoxGeometry(MARKET_MARKER_HIT_SIZE, MARKET_MARKER_HIT_SIZE, 0.08),
      new MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    ));

    return marker;
  }, [value]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!isReady || !globe) return undefined;

    const controls = globe.controls();
    controls.enableDamping = true;
    controls.autoRotateSpeed = 1.7;
    controls.autoRotate = !reduceMotion;
  }, [isReady, reduceMotion]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!isReady || !globe || !selectedCountry) return;

    globe.pointOfView(
      {
        lat: selectedCountry.coordinates.lat,
        lng: selectedCountry.coordinates.lng,
        altitude: 1.75,
      },
      reduceMotion ? 0 : 900,
    );
  }, [isReady, reduceMotion, selectedCountry]);

  useEffect(() => {
    if (!pulseSequence || reduceMotion) return undefined;

    let pulseCount = 1;
    setGlobalPulseCount(pulseCount);
    const interval = window.setInterval(() => {
      pulseCount += 1;
      setGlobalPulseCount(Math.min(pulseCount, countries.length));
      if (pulseCount >= countries.length) window.clearInterval(interval);
    }, GLOBAL_PULSE_STEP_MS);
    const timeout = window.setTimeout(() => setGlobalPulseCount(null), GLOBAL_PULSE_DURATION_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [countries.length, pulseSequence, reduceMotion]);

  useEffect(() => () => globeMaterial.dispose(), [globeMaterial]);

  const selectPoint = useCallback((point: object) => {
    if (isMarketCountry(point)) onSelect(point.id);
  }, [onSelect]);

  const setMarkerHover = useCallback((point: object | null) => {
    const globe = globeRef.current;
    if (!isReady || !globe) return;

    const controls = globe.controls();
    controls.autoRotateSpeed = 1.7;
    controls.autoRotate = point === null && !reduceMotion;
  }, [isReady, reduceMotion]);

  const beginPointerInteraction = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    dragOrigin.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  }, []);

  const trackPointerInteraction = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = dragOrigin.current;
    if (!origin || origin.pointerId !== event.pointerId) return;

    const horizontalDistance = event.clientX - origin.x;
    const verticalDistance = event.clientY - origin.y;
    if ((horizontalDistance ** 2) + (verticalDistance ** 2) < DRAG_THRESHOLD_PX ** 2) return;

    dragOrigin.current = null;
  }, []);

  const endPointerInteraction = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragOrigin.current?.pointerId === event.pointerId) dragOrigin.current = null;
  }, []);

  const fallback = <p className="country-globe__fallback" role="status">{text.globeFallback}</p>;

  return (
    <section className="country-globe" aria-label={text.globeInteractionLabel}>
      <div className="country-globe__header vc-visually-hidden">
        <p className="vc-eyebrow">{text.globeEyebrow}</p>
        <p className="country-globe__instruction">{text.globeDragInstruction}</p>
      </div>

      <div
        className="country-globe__visual"
        onPointerDown={beginPointerInteraction}
        onPointerMove={trackPointerInteraction}
        onPointerUp={endPointerInteraction}
        onPointerCancel={endPointerInteraction}
      >
        <GlobeErrorBoundary fallback={fallback}>
          <Suspense fallback={<p className="country-globe__fallback" role="status">{text.globeLoading}</p>}>
            <Globe
              ref={globeRef}
              width={720}
              height={720}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl={null}
              globeMaterial={globeMaterial}
              showAtmosphere={false}
              showGraticules
              polygonsData={countryPolygons as Feature<Geometry>[]}
              polygonCapColor={() => 'rgba(226, 229, 230, 0.82)'}
              polygonSideColor={() => 'rgba(210, 214, 216, 0.22)'}
              polygonStrokeColor={() => 'rgba(112, 120, 124, 0.52)'}
              polygonAltitude={0.004}
              polygonsTransitionDuration={reduceMotion ? 0 : 400}
              objectsData={[...countries]}
              objectLat={(point) => (point as MarketCountry).coordinates.lat}
              objectLng={(point) => (point as MarketCountry).coordinates.lng}
              objectAltitude={(point) => (
                (point as MarketCountry).id === value ? 0.018 : 0.012
              )}
              objectFacesSurfaces
              objectThreeObject={createMarketMarker}
              objectLabel={(point) => (point as MarketCountry).label[locale]}
              ringsData={ringPoints}
              ringLat={(point) => (point as MarketCountry).coordinates.lat}
              ringLng={(point) => (point as MarketCountry).coordinates.lng}
              ringAltitude={RADAR_RIPPLE_ALTITUDE}
              ringColor={() => ['rgba(180, 35, 32, 0.55)', 'rgba(180, 35, 32, 0)']}
              ringMaxRadius={2.15}
              ringPropagationSpeed={0.9}
              ringRepeatPeriod={globalPulseCount === null ? 1_800 : 10_000}
              onObjectClick={selectPoint}
              onObjectHover={setMarkerHover}
              onGlobeReady={() => {
                if (globeRef.current) tuneGraticules(globeRef.current);
                setIsReady(true);
              }}
            />
          </Suspense>
        </GlobeErrorBoundary>
      </div>

      <ul className="country-globe__accessible-markers vc-visually-hidden" aria-label={text.globeMarkerList}>
        {countries.map((country) => (
          <li key={country.id}>
            <button
              type="button"
              aria-pressed={country.id === value}
              onClick={() => onSelect(country.id)}
            >
              {text.selectCountry(country.label[locale])}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
