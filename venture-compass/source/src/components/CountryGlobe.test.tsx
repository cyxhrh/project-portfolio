import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  BoxGeometry,
  CircleGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
} from 'three';
import { afterEach, vi } from 'vitest';
import { marketCountries } from '../app/marketCountries';
import { CountryGlobe } from './CountryGlobe';

type MockGlobeProps = {
  backgroundColor?: string;
  globeMaterial?: Material;
  showAtmosphere?: boolean;
  showGraticules?: boolean;
  polygonsData?: object[];
  polygonCapColor?: (polygon: object) => string;
  polygonStrokeColor?: (polygon: object) => string;
  polygonAltitude?: number;
  pointsData?: object[];
  objectsData?: object[];
  objectThreeObject?: (point: object) => Object3D;
  objectLabel?: (point: object) => string;
  objectAltitude?: (point: object) => number;
  ringsData?: object[];
  ringLat?: (point: object) => number;
  ringLng?: (point: object) => number;
  ringColor?: (point: object) => string[];
  ringAltitude?: number;
  ringMaxRadius?: number;
  ringPropagationSpeed?: number;
  ringRepeatPeriod?: number;
  onGlobeReady?: () => void;
  onPointClick?: (point: object) => void;
  onObjectClick?: (point: object) => void;
  onObjectHover?: (point: object | null, previousPoint: object | null) => void;
};

type MockGraticuleMaterial = {
  type: string;
  color: {
    getHexString: () => string;
    set: (color: string) => void;
  };
  opacity: number;
};

const globeMock = vi.hoisted(() => ({
  autoRotate: false,
  autoRotateSpeed: 0,
  graticuleMaterial: {
    type: 'LineBasicMaterial',
    color: {
      getHexString: () => 'd3d3d3',
      set: (color: string) => {
        globeMock.graticuleMaterial.color.getHexString = () => color.slice(1);
      },
    },
    opacity: 0.1,
  } as MockGraticuleMaterial,
  pointOfViewCalls: [] as Array<{
    point: { lat?: number; lng?: number; altitude?: number };
    duration?: number;
  }>,
  shouldThrow: false,
  startListener: null as (() => void) | null,
  props: null as MockGlobeProps | null,
}));

vi.mock('react-globe.gl', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const controls = {
    get autoRotate() { return globeMock.autoRotate; },
    set autoRotate(value: boolean) { globeMock.autoRotate = value; },
    get autoRotateSpeed() { return globeMock.autoRotateSpeed; },
    set autoRotateSpeed(value: number) { globeMock.autoRotateSpeed = value; },
    addEventListener: (event: string, listener: () => void) => {
      if (event === 'start') globeMock.startListener = listener;
    },
    removeEventListener: (event: string, listener: () => void) => {
      if (event === 'start' && globeMock.startListener === listener) globeMock.startListener = null;
    },
  };

  const MockGlobe = React.forwardRef<Record<string, unknown>, MockGlobeProps>((props, ref) => {
    globeMock.props = props;
    React.useImperativeHandle(ref, () => ({
      controls: () => controls,
      scene: () => ({
        traverse: (visit: (object: object) => void) => visit({
          type: 'LineSegments',
          material: globeMock.graticuleMaterial,
        }),
      }),
      pointOfView: (
        point: { lat?: number; lng?: number; altitude?: number },
        duration?: number,
      ) => {
        globeMock.pointOfViewCalls.push({ point, duration });
      },
    }));
    React.useEffect(() => props.onGlobeReady?.(), [props.onGlobeReady]);

    if (globeMock.shouldThrow) throw new Error('WebGL unavailable');

    const japan = (props.objectsData ?? props.pointsData)?.find((point) => (
      (point as { id?: string }).id === 'Japan'
    ));

    return (
      <button
        type="button"
        aria-label="Visual Japan marker"
        onPointerDown={() => globeMock.startListener?.()}
        onClick={() => japan && (props.onObjectClick ?? props.onPointClick)?.(japan)}
      >
        Visual marker
      </button>
    );
  });

  return { default: MockGlobe };
});

afterEach(() => vi.useRealTimers());

describe('CountryGlobe', () => {
  beforeEach(() => {
    globeMock.autoRotate = false;
    globeMock.autoRotateSpeed = 0;
    globeMock.graticuleMaterial = {
      type: 'LineBasicMaterial',
      color: {
        getHexString: () => 'd3d3d3',
        set: (color: string) => {
          globeMock.graticuleMaterial.color.getHexString = () => color.slice(1);
        },
      },
      opacity: 0.1,
    };
    globeMock.pointOfViewCalls = [];
    globeMock.shouldThrow = false;
    globeMock.startListener = null;
    globeMock.props = null;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  test('renders a restrained, visible graticule beneath the country outlines and small red circular markets', async () => {
    render(
      <CountryGlobe
        locale="en"
        countries={marketCountries}
        value="Japan"
        onSelect={vi.fn()}
      />,
    );

    await screen.findByRole('button', { name: 'Visual Japan marker' });
    const props = globeMock.props;

    expect(props).toMatchObject({
      backgroundColor: 'rgba(0,0,0,0)',
      showAtmosphere: false,
      showGraticules: true,
    });
    expect(props?.globeMaterial).toMatchObject({
      type: 'MeshBasicMaterial',
      transparent: true,
      opacity: 0.88,
    });
    expect((props?.globeMaterial as MeshBasicMaterial).color.getHexString()).toBe('fafaf8');
    expect(props?.polygonCapColor?.({})).toBe('rgba(226, 229, 230, 0.82)');
    expect(props?.polygonStrokeColor?.({})).toBe('rgba(112, 120, 124, 0.52)');
    expect(globeMock.graticuleMaterial.color.getHexString()).toBe('778087');
    expect(globeMock.graticuleMaterial.opacity).toBe(0.42);
    expect(props?.objectsData).toHaveLength(marketCountries.length);
    expect(props?.pointsData).toBeUndefined();

    const marker = props?.objectThreeObject?.(marketCountries[0]) as Group;
    expect(marker).toMatchObject({ type: 'Group' });
    expect(marker.children).toHaveLength(2);

    const circleMarker = marker.children[0] as Mesh<CircleGeometry, MeshBasicMaterial>;
    expect(circleMarker).toMatchObject({
      type: 'Mesh',
      geometry: { type: 'CircleGeometry' },
      material: { type: 'MeshBasicMaterial', transparent: true },
    });
    expect(circleMarker.geometry.parameters).toMatchObject({ radius: 0.625, segments: 32 });
    expect(circleMarker.material.color.getHexString()).toBe('d34b45');

    const hitTarget = marker.children[1] as Mesh<BoxGeometry, MeshBasicMaterial>;
    expect(hitTarget.geometry.parameters).toMatchObject({ width: 3.6, height: 3.6 });
    expect(hitTarget.material).toMatchObject({ transparent: true, opacity: 0 });
  });

  test('renders circular market faces with transparent hit targets and keeps radar above surface layers', async () => {
    render(
      <CountryGlobe
        locale="en"
        countries={marketCountries}
        value="Japan"
        onSelect={vi.fn()}
      />,
    );

    await screen.findByRole('button', { name: 'Visual Japan marker' });
    const japan = marketCountries.find((country) => country.id === 'Japan')!;
    const marker = globeMock.props?.objectThreeObject?.(japan) as Group;
    const visibleMarker = marker.children[0] as Mesh<CircleGeometry, MeshBasicMaterial>;
    const hitTarget = marker.children[1] as Mesh<BoxGeometry, MeshBasicMaterial>;

    expect(visibleMarker.geometry).toMatchObject({
      type: 'CircleGeometry',
      parameters: { radius: 0.9, segments: 32 },
    });
    expect(visibleMarker.material).toMatchObject({
      type: 'MeshBasicMaterial',
      transparent: true,
      depthWrite: false,
    });
    expect(hitTarget.geometry).toMatchObject({
      type: 'BoxGeometry',
      parameters: { width: 3.6, height: 3.6 },
    });
    expect(hitTarget.material).toMatchObject({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    expect(globeMock.props?.ringAltitude).toBeGreaterThan(globeMock.props!.polygonAltitude!);
    expect(globeMock.props?.ringAltitude).toBeGreaterThan(globeMock.props!.objectAltitude!(japan));
  });

  test('feeds the repeating radar ripple layer only the currently selected market', async () => {
    const { rerender } = render(
      <CountryGlobe
        locale="en"
        countries={marketCountries}
        value="Japan"
        onSelect={vi.fn()}
      />,
    );

    await screen.findByRole('button', { name: 'Visual Japan marker' });
    const japan = marketCountries.find((country) => country.id === 'Japan');
    expect(globeMock.props?.ringsData).toEqual([japan]);
    expect(globeMock.props?.ringLat?.(japan!)).toBe(36.2048);
    expect(globeMock.props?.ringLng?.(japan!)).toBe(138.2529);
    expect(globeMock.props?.ringColor?.(japan!)).toEqual([
      'rgba(180, 35, 32, 0.55)',
      'rgba(180, 35, 32, 0)',
    ]);

    const rippleLifetimeMs = (
      globeMock.props!.ringMaxRadius! / globeMock.props!.ringPropagationSpeed!
    ) * 1_000;
    const concurrentRingCount = Math.ceil(rippleLifetimeMs / globeMock.props!.ringRepeatPeriod!);
    expect(concurrentRingCount).toBeGreaterThanOrEqual(2);
    expect(concurrentRingCount).toBeLessThanOrEqual(3);

    rerender(
      <CountryGlobe
        locale="en"
        countries={marketCountries}
        value="France"
        onSelect={vi.fn()}
      />,
    );

    const france = marketCountries.find((country) => country.id === 'France');
    expect(globeMock.props?.ringsData).toEqual([france]);
  });

  test('adds each configured market once in sequence after a new idea submission', async () => {
    const { rerender } = render(
      <CountryGlobe
        locale="en"
        countries={marketCountries}
        value="Japan"
        onSelect={vi.fn()}
        pulseSequence={0}
      />,
    );

    await screen.findByRole('button', { name: 'Visual Japan marker' });
    vi.useFakeTimers();
    rerender(
      <CountryGlobe
        locale="en"
        countries={marketCountries}
        value="Japan"
        onSelect={vi.fn()}
        pulseSequence={1}
      />,
    );

    expect(globeMock.props?.ringsData).toEqual(marketCountries.slice(0, 1));
    expect(globeMock.props?.ringRepeatPeriod).toBeGreaterThan(4_000);

    act(() => vi.advanceTimersByTime(180));
    expect(globeMock.props?.ringsData).toEqual(marketCountries.slice(0, 2));

    act(() => vi.advanceTimersByTime(1_080));
    expect(globeMock.props?.ringsData).toEqual(marketCountries);

    act(() => vi.advanceTimersByTime(2_400));
    expect(globeMock.props?.ringsData).toEqual([
      marketCountries.find((country) => country.id === 'Japan'),
    ]);
    vi.useRealTimers();
  });

  test('disables radar ripples for reduced motion while keeping static selected-marker emphasis', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const { rerender } = render(
      <CountryGlobe
        locale="en"
        countries={marketCountries}
        value="Japan"
        onSelect={vi.fn()}
        pulseSequence={0}
      />,
    );

    await screen.findByRole('button', { name: 'Visual Japan marker' });
    expect(globeMock.props?.ringsData).toEqual([]);

    rerender(
      <CountryGlobe
        locale="en"
        countries={marketCountries}
        value="Japan"
        onSelect={vi.fn()}
        pulseSequence={1}
      />,
    );
    expect(globeMock.props?.ringsData).toEqual([]);

    const japan = marketCountries.find((country) => country.id === 'Japan')!;
    const unitedStates = marketCountries.find((country) => country.id === 'United States')!;
    const selectedMarker = globeMock.props?.objectThreeObject?.(japan) as Group;
    const unselectedMarker = globeMock.props?.objectThreeObject?.(unitedStates) as Group;
    const selectedCircle = selectedMarker.children[0] as Mesh<CircleGeometry, MeshBasicMaterial>;
    const unselectedCircle = unselectedMarker.children[0] as Mesh<CircleGeometry, MeshBasicMaterial>;

    expect(selectedCircle.geometry.parameters.radius).toBe(0.9);
    expect(selectedCircle.material.color.getHexString()).toBe('b42320');
    expect(unselectedCircle.geometry.parameters.radius).toBe(0.625);
  });

  test('lets keyboard and pointer users select a localized market', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <CountryGlobe
        locale="zh"
        countries={marketCountries}
        value="United States"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByLabelText('可拖拽旋转的全球市场地球')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择美国' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '选择日本' }));

    expect(onSelect).toHaveBeenCalledWith('Japan');
  });

  test('localizes its accessible interaction contract in English', () => {
    render(
      <CountryGlobe
        locale="en"
        countries={marketCountries}
        value="Japan"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Draggable global markets globe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Japan' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('maps a visual point click to its stable country identifier', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <CountryGlobe
        locale="en"
        countries={marketCountries}
        value="United States"
        onSelect={onSelect}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Visual Japan marker' }));

    expect(onSelect).toHaveBeenCalledWith('Japan');
  });

  test('keeps idle rotation after a click without meaningful pointer movement', async () => {
    const user = userEvent.setup();
    render(
      <CountryGlobe
        locale="en"
        countries={marketCountries}
        value="Japan"
        onSelect={vi.fn()}
      />,
    );

    const marker = await screen.findByRole('button', { name: 'Visual Japan marker' });
    await waitFor(() => expect(globeMock.autoRotate).toBe(true));
    expect(globeMock.autoRotateSpeed).toBe(1.7);

    await user.click(marker);

    expect(globeMock.autoRotate).toBe(true);
  });

  test('pauses rotation while a market marker is hovered and resumes at idle speed on leave', async () => {
    render(
      <CountryGlobe
        locale="en"
        countries={marketCountries}
        value="Japan"
        onSelect={vi.fn()}
      />,
    );

    await screen.findByRole('button', { name: 'Visual Japan marker' });
    await waitFor(() => expect(globeMock.autoRotate).toBe(true));

    globeMock.props?.onObjectHover?.(marketCountries[0], null);
    expect(globeMock.autoRotate).toBe(false);

    globeMock.props?.onObjectHover?.(null, marketCountries[0]);
    expect(globeMock.autoRotate).toBe(true);
    expect(globeMock.autoRotateSpeed).toBe(1.7);
  });

  test('rotates toward the selected market and keeps idle rotation after a real drag', async () => {
    render(
      <CountryGlobe
        locale="en"
        countries={marketCountries}
        value="Japan"
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => expect(globeMock.autoRotate).toBe(true));
    expect(globeMock.pointOfViewCalls[globeMock.pointOfViewCalls.length - 1]).toMatchObject({
      point: { lat: 36.2048, lng: 138.2529 },
    });

    const marker = await screen.findByRole('button', { name: 'Visual Japan marker' });
    fireEvent.pointerDown(marker, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(marker, { clientX: 32, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(marker, { clientX: 32, clientY: 20, pointerId: 1 });

    expect(globeMock.autoRotate).toBe(true);
    expect(globeMock.autoRotateSpeed).toBe(1.7);
  });

  test('does not start idle rotation when reduced motion is preferred', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    render(
      <CountryGlobe
        locale="en"
        countries={marketCountries}
        value="Japan"
        onSelect={vi.fn()}
      />,
    );

    await screen.findByRole('button', { name: 'Visual Japan marker' });

    expect(globeMock.autoRotate).toBe(false);
    expect(globeMock.pointOfViewCalls[globeMock.pointOfViewCalls.length - 1]?.duration).toBe(0);
  });

  test('keeps the accessible market list usable when WebGL rendering fails', async () => {
    globeMock.shouldThrow = true;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <CountryGlobe
        locale="zh"
        countries={marketCountries}
        value="United States"
        onSelect={onSelect}
      />,
    );

    expect(await screen.findByText('地图不可用，仍可输入国家。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '选择日本' }));

    expect(onSelect).toHaveBeenCalledWith('Japan');
    consoleError.mockRestore();
  });
});
