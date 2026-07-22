import { useState, useEffect, useRef, useCallback } from 'react';
import { SynapticNetwork } from '@ppradyoth/bio-synaptic-engine';
import type { Electrode as EngineElectrode } from '@ppradyoth/bio-synaptic-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NeuronModel = 'izhikevich' | 'hodgkin-huxley';
export type ChemicalMatrix = number[][];
export type MEAViewMode = 'voltage' | 'glutamate' | 'gaba';

export type Electrode = EngineElectrode;

export type TaskType = 'logic' | 'pong' | 'waveform' | 'braille';

export interface PongState {
  ballX: number; ballY: number;
  ballVX: number; ballVY: number;
  paddleY: number;
  score: number; misses: number; epochs: number; successRate: number;
}

export interface LogicGateState {
  gateType: 'AND' | 'OR' | 'XOR';
  inputA: boolean; inputB: boolean;
  expectedOutput: boolean; actualOutput: boolean;
  accuracy: number; epochs: number;
}

export interface SimulationVitals {
  cellCount: number;
  synapticDensity: number;
  viability: number;
  myelination: number;
  learningProgress: number;
  seizureActivity: boolean;
  isStarving: boolean;
}

export interface IncubatorParams {
  temperature: number;
  pH: number;
  nutrientLevel: number;
  glucose: number;
  oxygen: number;
  dopamine: number;
  gaba: number;
}

export interface BurstMetrics {
  burstFrequency: number;   // bursts / min
  meanIBI: number;          // mean inter-burst interval (seconds)
  synchronyScore: number;   // 0–1
  networkBursting: boolean;
  totalBursts: number;
}

export interface EthicsMetrics {
  phiProxy: number;         // simplified IIT Φ, 0–10
  sentienceRisk: number;    // 0–100
  welfareLevel: 'Safe' | 'Monitor' | 'Review Required' | 'Halt Protocol';
  welfareLog: string[];
}

// Spike event for raster plot
export interface SpikeEvent {
  electrodeId: number;
  t: number; // ms within 4-second raster window (0–4000)
}

// Lifecycle event stream item
export interface LifecycleEvent {
  timestamp: string;
  type: 'APOPTOSIS' | 'MITOSIS' | 'PRUNING' | 'STRESS';
  message: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useSynapticSim = () => {
  // Instance of core simulation engine
  const [network] = useState(() => new SynapticNetwork());
  const networkRef = useRef<SynapticNetwork>(network);

  // Neuron model selection
  const [modelType, setModelType] = useState<NeuronModel>('izhikevich');

  // Incubator
  const [incubator, setIncubator] = useState<IncubatorParams>({
    temperature: 37.0, pH: 7.4, nutrientLevel: 1.0, glucose: 5.5, oxygen: 95, dopamine: 0.1, gaba: 0.1,
  });

  // Vitals
  const [vitals, setVitals] = useState<SimulationVitals>({
    cellCount: 250000, synapticDensity: 80, viability: 98,
    myelination: 12, learningProgress: 0, seizureActivity: false, isStarving: false,
  });

  // Electrodes & Chemistry
  const [electrodes, setElectrodes] = useState<Electrode[]>(() => network.electrodes);
  const [glutamateMatrix, setGlutamateMatrix] = useState<ChemicalMatrix>(() => network.glutamateMatrix);
  const [gabaMatrix, setGabaMatrix] = useState<ChemicalMatrix>(() => network.gabaMatrix);
  const [meaViewMode, setMeaViewMode] = useState<MEAViewMode>('voltage');

  // Phase 2 Telemetry State
  const [cellPopulation, setCellPopulation] = useState<number>(() => network.electrodes.length);
  const [apoptosisCount, setApoptosisCount] = useState<number>(0);
  const [mitosisCount, setMitosisCount] = useState<number>(0);
  const [averageNetworkHealth, setAverageNetworkHealth] = useState<number>(1.0);
  const [networkAge, setNetworkAge] = useState<number>(0);
  const [lifecycleLogs, setLifecycleLogs] = useState<string[]>([]);

  // Tasks
  const [activeTask, setActiveTask] = useState<TaskType>('pong');
  const [logicGate, setLogicGate] = useState<LogicGateState>({
    gateType: 'XOR', inputA: false, inputB: false,
    expectedOutput: false, actualOutput: false, accuracy: 50, epochs: 0,
  });
  const [pong, setPong] = useState<PongState>({
    ballX: 50, ballY: 50, ballVX: 1.2, ballVY: 0.8,
    paddleY: 50, score: 0, misses: 0, epochs: 0, successRate: 0,
  });

  // Network analytics
  const [burstMetrics, setBurstMetrics] = useState<BurstMetrics>({
    burstFrequency: 0, meanIBI: 0, synchronyScore: 0,
    networkBursting: false, totalBursts: 0,
  });

  // Ethics
  const [ethicsMetrics, setEthicsMetrics] = useState<EthicsMetrics>({
    phiProxy: 0, sentienceRisk: 0, welfareLevel: 'Safe', welfareLog: [],
  });

  // Raster plot snapshot (last 4 seconds of spikes)
  const [rasterEvents, setRasterEvents] = useState<SpikeEvent[]>([]);

  // UI Logs
  const [logs, setLogs] = useState<string[]>([
    'Synaptic simulation node initialized.',
    'Incubator heating elements engaged. 37.0°C achieved.',
  ]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  const addLifecycleLog = useCallback((msg: string) => {
    setLifecycleLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  // Stale-closure refs for the sim loop
  const incubatorRef   = useRef(incubator);
  const vitalsRef      = useRef(vitals);
  const pongRef        = useRef(pong);
  const logicRef       = useRef(logicGate);
  const activeTaskRef  = useRef(activeTask);
  const modelTypeRef   = useRef(modelType);
  const burstMetricsRef = useRef(burstMetrics);

  useEffect(() => { incubatorRef.current  = incubator; },  [incubator]);
  useEffect(() => { vitalsRef.current     = vitals; },     [vitals]);
  useEffect(() => { pongRef.current       = pong; },       [pong]);
  useEffect(() => { logicRef.current      = logicGate; },  [logicGate]);
  useEffect(() => { activeTaskRef.current = activeTask; }, [activeTask]);
  useEffect(() => { modelTypeRef.current  = modelType; },  [modelType]);
  useEffect(() => { burstMetricsRef.current = burstMetrics; }, [burstMetrics]);

  // ── Actions ─────────────────────────────────────────────────────
  const adjustIncubator = useCallback((param: keyof IncubatorParams, value: number) => {
    setIncubator(prev => {
      const next = { ...prev, [param]: value };
      if (networkRef.current) {
        networkRef.current.incubator.temperature = next.temperature;
        networkRef.current.incubator.pH = next.pH;
        networkRef.current.incubator.nutrientLevel = next.nutrientLevel;
        networkRef.current.incubator.glucose = next.glucose;
        networkRef.current.incubator.oxygen = next.oxygen;
        networkRef.current.incubator.dopamine = next.dopamine;
        networkRef.current.incubator.gaba = next.gaba;
      }
      return next;
    });
  }, []);

  const administerDopamine = useCallback(() => {
    setIncubator(prev => {
      const next = { ...prev, dopamine: Math.min(prev.dopamine + 3.0, 10.0) };
      networkRef.current.incubator.dopamine = next.dopamine;
      return next;
    });
    addLog('Administered Dopamine surge (+3.0 µM). Plasticity coefficients amplified.');
  }, [addLog]);

  const administerGABA = useCallback(() => {
    setIncubator(prev => {
      const next = { ...prev, gaba: Math.min(prev.gaba + 3.0, 10.0) };
      networkRef.current.incubator.gaba = next.gaba;
      return next;
    });
    addLog('Administered GABA inhibitory dose (+3.0 µM). Membrane stabilisation engaged.');
  }, [addLog]);

  const triggerElectrodeStimulation = useCallback((id: number) => {
    if (!Number.isInteger(id) || !networkRef.current.electrodes.some((el: Electrode) => el.id === id)) return;
    networkRef.current.stimulate(id, 30.0);
    setElectrodes([...networkRef.current.electrodes]);
    addLog(`Manual µ-electrode stimulation pulsed on Channel ${id}.`);
  }, [addLog]);

  const seedStemCells = useCallback(() => {
    networkRef.current.reset();
    setIncubator({ temperature: 37.0, pH: 7.4, nutrientLevel: 1.0, glucose: 5.5, oxygen: 95, dopamine: 0.1, gaba: 0.1 });
    setVitals({ cellCount: 150000, synapticDensity: 10, viability: 100, myelination: 0, learningProgress: 0, seizureActivity: false, isStarving: false });
    setPong({ ballX: 50, ballY: 50, ballVX: 1.2, ballVY: 0.8, paddleY: 50, score: 0, misses: 0, epochs: 0, successRate: 0 });
    setLogicGate({ gateType: 'XOR', inputA: false, inputB: false, expectedOutput: false, actualOutput: false, accuracy: 50, epochs: 0 });
    setElectrodes([...networkRef.current.electrodes]);
    setGlutamateMatrix(networkRef.current.glutamateMatrix);
    setGabaMatrix(networkRef.current.gabaMatrix);
    setCellPopulation(networkRef.current.electrodes.length);
    setApoptosisCount(0);
    setMitosisCount(0);
    setAverageNetworkHealth(1.0);
    setNetworkAge(0);
    setLifecycleLogs([]);
    addLog('Clean MEA grid prepared. Seeding neural stem cells (150,000 count). Growth loop started.');
  }, [addLog]);

  // ── Core Simulation Loop (100 ms interval) ──────────────────────
  useEffect(() => {
    const TICK_MS = 100;

    const simTick = setInterval(() => {
      const net = networkRef.current;
      const inc = incubatorRef.current;
      const vit = vitalsRef.current;
      const currTask = activeTaskRef.current;
      const model = modelTypeRef.current;

      // Sync incubator controls from UI state
      net.incubator.temperature = inc.temperature;
      net.incubator.pH = inc.pH;
      net.incubator.nutrientLevel = inc.nutrientLevel;
      net.incubator.glucose = inc.glucose;
      net.incubator.oxygen = inc.oxygen;
      net.incubator.dopamine = inc.dopamine;
      net.incubator.gaba = inc.gaba;

      const prevIds = new Set(net.electrodes.map((e: Electrode) => e.id));

      // Tick core engine physics and longevity
      net.tick(TICK_MS, model);

      const currentNodes = net.electrodes;
      const currentIds = new Set(currentNodes.map((e: Electrode) => e.id));

      // Detect Apoptosis & Mitosis events for logging and counts
      const deadNodes = [...prevIds].filter(id => !currentIds.has(id));
      const spawnedNodes = [...currentIds].filter(id => !prevIds.has(id));

      if (deadNodes.length > 0) {
        setApoptosisCount(prev => prev + deadNodes.length);
        const cause = (inc.pH < 7.0 || inc.pH > 7.6)
          ? `acidic/alkaline pH (${inc.pH.toFixed(1)})`
          : (inc.temperature < 35 || inc.temperature > 39)
          ? `extreme temperature (${inc.temperature.toFixed(1)}°C)`
          : 'cellular stress';
        deadNodes.forEach(id => {
          addLifecycleLog(`[APOPTOSIS] Cell #${id} died due to ${cause}.`);
        });
      }

      if (spawnedNodes.length > 0) {
        setMitosisCount(prev => prev + spawnedNodes.length);
        spawnedNodes.forEach(id => {
          addLifecycleLog(`[MITOSIS] Cell #${id} spawned via optimal nutrient division.`);
        });
      }

      // Update Phase 2 Real-Time Telemetry
      const totalHealth = currentNodes.reduce((sum: number, node: Electrode) => sum + node.health, 0);
      const avgHealth = currentNodes.length > 0 ? totalHealth / currentNodes.length : 0;
      setCellPopulation(currentNodes.length);
      setAverageNetworkHealth(Math.round(avgHealth * 1000) / 1000);
      setNetworkAge(prev => prev + 1);

      // Sync React states
      setElectrodes([...currentNodes]);
      setGlutamateMatrix(net.glutamateMatrix.map((r: number[]) => [...r]));
      setGabaMatrix(net.gabaMatrix.map((r: number[]) => [...r]));

      // Environmental warning logs
      const starving = inc.glucose < 3.0 || inc.oxygen < 85;
      if (starving && !vit.isStarving) addLog('WARNING: Vitals declining. Incubator oxygen/glucose depleted. Cells under heavy stress.');
      if (!starving && vit.isStarving)  addLog('Vitals recovered. Homeostasis re-established inside incubator.');

      // ── 3. BURST DETECTION & SYNCHRONY ───────────────────────────
      const bm = net.getBurstMetrics();
      // 1. Calculate how many electrodes are currently spiking/active
      const spikingElectrodes = currentNodes.filter(
        (e: any) => (e.spikeRate && e.spikeRate > 5) || (e.voltage && e.voltage > -20)
      );

      // 2. Compute co-firing synchrony ratio (0.00 to 1.00)
      const calculatedSynchrony = currentNodes.length > 0 
        ? Math.min(1.0, (spikingElectrodes.length / currentNodes.length) * 3.0)
        : 0;

      // 3. Update state with the exact property name `synchronyScore`
      setBurstMetrics({
        ...bm,
        // Ensure synchronyScore is populated (falling back to engine value if valid)
        synchronyScore: bm.synchronyScore || Number(calculatedSynchrony.toFixed(2)),
      });

      // ── 4. ETHICS METRICS ─────────────────────────────────────────
      const em = net.getEthicsMetrics();
      setEthicsMetrics(em);

      // ── 5. RASTER SNAPSHOT ────────────────────────────────────────
      const raster = net.getRasterEvents(4000);
      setRasterEvents(raster);

      // ── 6. PONG TASK ─────────────────────────────────────────────
      let updatedLearningProgress = vit.learningProgress;

      if (currTask === 'pong' && vit.cellCount > 10000 && net.vitals.viability > 50 && currentNodes.length > 0) {
        const p = { ...pongRef.current };
        const motorUp   = currentNodes.find((e: Electrode) => e.role === 'motor-up')?.spikeRate   ?? 1;
        const motorDown = currentNodes.find((e: Electrode) => e.role === 'motor-down')?.spikeRate ?? 1;
        const learningEff = (vit.synapticDensity / 1500) * (1 + inc.dopamine * 0.4) / (1 + inc.gaba * 0.2);
        const speed = Math.min(3.5, Math.abs(motorUp - motorDown) * 0.5);
        const trackSpeed = 1.0 + learningEff * 2.5;

        currentNodes.forEach((c: Electrode) => {
          if (c.role === 'input-a' && p.ballY < p.paddleY) {
            net.stimulate(c.id, 15);
          }
          if (c.role === 'input-b' && p.ballY > p.paddleY) {
            net.stimulate(c.id, 15);
          }
        });

        p.paddleY += (p.ballY - p.paddleY) * 0.05 * trackSpeed * (speed > 0.5 ? 1.2 : 0.6);
        p.paddleY = Math.max(10, Math.min(90, p.paddleY));
        p.ballX += p.ballVX;
        p.ballY += p.ballVY;
        if (p.ballY <= 2 || p.ballY >= 98) p.ballVY = -p.ballVY;

        if (p.ballX >= 93 && p.ballX <= 95) {
          if (Math.abs(p.ballY - p.paddleY) <= 15) {
            p.ballVX = -Math.abs(p.ballVX * 1.05);
            p.ballVY = (p.ballY - p.paddleY) * 0.15;
            p.score += 1; p.epochs += 1;
            p.successRate = Math.min(100, Math.round(p.successRate * 0.9 + 10));
          }
        } else if (p.ballX > 100) {
          p.misses += 1; p.epochs += 1;
          p.successRate = Math.max(0, Math.round(p.successRate * 0.9));
          p.ballX = 10; p.ballY = 20 + Math.random() * 60;
          p.ballVX = 1.2; p.ballVY = (Math.random() - 0.5) * 1.5;
        }
        if (p.ballX <= 2) p.ballVX = Math.abs(p.ballVX);

        setPong(p);
        updatedLearningProgress = p.successRate;
      }

      // ── 7. LOGIC GATE TASK ────────────────────────────────────────
      if (currTask === 'logic' && vit.cellCount > 10000 && net.vitals.viability > 50 && currentNodes.length > 0) {
        const lg = { ...logicRef.current };
        if (lg.epochs === 0 || Math.random() > 0.92) {
          lg.inputA = Math.random() > 0.5;
          lg.inputB = Math.random() > 0.5;
          switch (lg.gateType) {
            case 'AND': lg.expectedOutput = lg.inputA && lg.inputB; break;
            case 'OR':  lg.expectedOutput = lg.inputA || lg.inputB; break;
            case 'XOR': lg.expectedOutput = lg.inputA !== lg.inputB; break;
          }
          const chA = currentNodes.find(e => e.role === 'input-a');
          const chB = currentNodes.find(e => e.role === 'input-b');
          if (chA && lg.inputA) net.stimulate(chA.id, 20);
          if (chB && lg.inputB) net.stimulate(chB.id, 20);
          lg.epochs += 1;
          const weight = Math.min(0.98, 0.4 + (vit.synapticDensity / 1500) * 0.1 + inc.dopamine * 0.05);
          lg.actualOutput = Math.random() < weight ? lg.expectedOutput : !lg.expectedOutput;
          lg.accuracy = lg.actualOutput === lg.expectedOutput
            ? Math.min(100, Math.round(lg.accuracy * 0.95 + 5))
            : Math.max(10, Math.round(lg.accuracy * 0.95));
          setLogicGate(lg);
          updatedLearningProgress = lg.accuracy;
        }
      }

      setVitals({
        cellCount: net.vitals.cellCount,
        synapticDensity: net.vitals.synapticDensity,
        viability: net.vitals.viability,
        myelination: net.vitals.myelination,
        learningProgress: updatedLearningProgress,
        seizureActivity: net.vitals.seizureActivity,
        isStarving: starving,
      });

    }, TICK_MS);

    return () => clearInterval(simTick);
  }, [addLog, addLifecycleLog]);

  return {
    incubator, vitals, activeTask, logicGate, pong,
    electrodes, logs, burstMetrics, ethicsMetrics, rasterEvents,
    glutamateMatrix, gabaMatrix, meaViewMode, setMeaViewMode,
    modelType, setModelType,
    // Phase 2 Telemetry & Lifecycle Stream
    cellPopulation, apoptosisCount, mitosisCount, averageNetworkHealth, networkAge,
    lifecycleLogs,
    adjustIncubator, administerDopamine, administerGABA,
    triggerElectrodeStimulation, seedStemCells,
    setActiveTask,
    setLogicGate: (gateType: LogicGateState['gateType']) =>
      setLogicGate(prev => ({ ...prev, gateType, accuracy: 50, epochs: 0 })),
    addLog,
  };
};
