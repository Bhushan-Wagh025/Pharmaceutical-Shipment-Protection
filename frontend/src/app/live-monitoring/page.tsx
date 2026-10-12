'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Thermometer,
  Snowflake,
  Layers,
  Wifi,
  WifiOff,
  Activity,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  Flame,
  ArrowRight,
  Cpu,
  Radio,
  Sliders,
  Volume2,
  VolumeX,
  AlertTriangle,
  AlertOctagon,
  Laptop,
  MapPin,
  Box,
  Cable,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Gauge,
  Sparkles,
  Settings,
  RefreshCw,
  HardDrive,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { api, type Gateway } from '@/lib/api';
import { useShipmentWebSocket } from '@/lib/websocket';
import type {
  HardwareStageId,
} from '@/components/simulator/HardwareArchitectureDiagram';

interface ChartPoint {
  time: string;
  packageTemp: number;
  coldTemp: number;
  limit: number;
}

interface EventItem {
  id: string;
  time: string;
  type: 'blue' | 'amber' | 'green' | 'red';
  message: string;
  isNew?: boolean;
}

type HardwareStage = HardwareStageId;
type TrayState = 'EXTENDED' | 'MOVING_IN' | 'PROTECTED' | 'MOVING_OUT' | 'ERROR';
type DataSourceMode = 'LIVE' | 'SIMULATED';

export default function LiveMonitoringPage() {
  // Real-time loop state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [isAutonomous, setIsAutonomous] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Pipeline Data Source Mode: LIVE (Real/Mock BLE Gateway) vs SIMULATED (Local Rig Sim)
  const [dataSource, setDataSource] = useState<DataSourceMode>('LIVE');
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [selectedGatewayId, setSelectedGatewayId] = useState<number | string>(1);
  const [selectedDeviceMac, setSelectedDeviceMac] = useState<string>('C3:4A:21:88:9F:12');
  const [lastReceivedTime, setLastReceivedTime] = useState<string>('Just now');
  const [serverTimestamp, setServerTimestamp] = useState<string>('');

  // Active hardware pipeline step currently executing
  const [activeHwStage, setActiveHwStage] = useState<HardwareStage>('BEACON');
  const [isAutoWalkthrough, setIsAutoWalkthrough] = useState<boolean>(true);

  // Live temperatures
  const [packageTemp, setPackageTemp] = useState<number>(7.2);
  const [ambientTemp, setAmbientTemp] = useState<number>(22.5);
  const [coldTemp, setColdTemp] = useState<number>(3.2);

  // Motorized Tray: 0 (Extended outside in ambient) to 100 (Protected inside cooling chamber)
  const [trayPosition, setTrayPosition] = useState<number>(0);
  const [isTrayMoving, setIsTrayMoving] = useState<boolean>(false);
  const [trayTarget, setTrayTarget] = useState<number>(0);
  const [trayState, setTrayState] = useState<TrayState>('EXTENDED');
  const [isEmergencyStopped, setIsEmergencyStopped] = useState<boolean>(false);

  // AI Prediction & Risk
  const [predictedTemp, setPredictedTemp] = useState<number>(7.6);
  const [forecastHorizon, setForecastHorizon] = useState<string>('15 min');
  const [tempMinLimit, setTempMinLimit] = useState<number>(2.0);
  const [tempMaxLimit, setTempMaxLimit] = useState<number>(8.0);
  const [riskLevel, setRiskLevel] = useState<'NORMAL' | 'ELEVATED' | 'CRITICAL'>('NORMAL');
  const [aiDecision, setAiDecision] = useState<string>('Monitoring (Normal)');
  const [decisionTime, setDecisionTime] = useState<string>('14:31:42');
  const [isBreached, setIsBreached] = useState<boolean>(false);

  // Hardware counters (increment live)
  const [packetsCount, setPacketsCount] = useState<number>(1428);
  const [motorCurrentMa, setMotorCurrentMa] = useState<number>(180);
  const [clockTime, setClockTime] = useState<string>('');
  const [batteryPct, setBatteryPct] = useState<number>(98);
  const [rssiDbm, setRssiDbm] = useState<number>(-58);

  // 6 Pipeline Steps (1 to 6)
  const [activeStep, setActiveStep] = useState<number>(1);

  // Recent Events Stream
  const [events, setEvents] = useState<EventItem[]>([
    { id: '1', time: '14:31:42', type: 'blue', message: 'Stage 6 (Cold Chamber): Package secured in Insulated Cold Compartment with Cold Pack' },
    { id: '2', time: '14:31:41', type: 'blue', message: 'Stage 5 (Servo & Tray): Position feedback LS2 Chamber Limit Switch engaged (100%)' },
    { id: '3', time: '14:31:40', type: 'blue', message: 'Stage 4 (ESP32): Executed USB Serial command from Laptop -> Driving Servo PWM' },
    { id: '4', time: '14:31:38', type: 'amber', message: 'Stage 3 (Laptop/Mini PC): scikit-learn AI Model predicted 8.1°C excursion -> Decision: Move to Cooling' },
    { id: '5', time: '14:28:15', type: 'green', message: 'Stage 2 (GAO Gateway): Forwarded MQTT JSON payload (Package Temp: 7.4°C)' },
    { id: '6', time: '14:28:05', type: 'green', message: 'Stage 1 (KKM K6 Beacon): Emitted BLE telemetry packet from package' },
  ]);

  // Rolling Live Chart Data
  const [chartData, setChartData] = useState<ChartPoint[]>([
    { time: '14:22', packageTemp: 5.8, coldTemp: 3.2, limit: 8.0 },
    { time: '14:24', packageTemp: 6.4, coldTemp: 3.2, limit: 8.0 },
    { time: '14:26', packageTemp: 7.1, coldTemp: 3.2, limit: 8.0 },
    { time: '14:28', packageTemp: 7.8, coldTemp: 3.2, limit: 8.0 },
    { time: '14:29', packageTemp: 8.1, coldTemp: 3.2, limit: 8.0 },
    { time: '14:30', packageTemp: 6.2, coldTemp: 3.2, limit: 8.0 },
    { time: '14:32', packageTemp: 5.4, coldTemp: 3.2, limit: 8.0 },
  ]);

  // Load configured gateways from backend
  useEffect(() => {
    api.getGateways()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setGateways(data);
          setSelectedGatewayId(data[0].id);
        }
      })
      .catch(() => {
        // Fallback default gateway
        setGateways([
          {
            id: 1,
            name: 'GAO BLE Gateway #1 (Warehouse A)',
            gateway_identifier: 'GAO-217030-GW01',
            host_url: 'http://192.168.1.100:8080',
            adapter_type: 'gao_ble',
            status: 'CONNECTED',
            is_enabled: true,
            is_monitoring: true,
          } as any,
        ]);
      });
  }, []);

  // Web Audio Synth
  const playBeep = useCallback((freq = 880, duration = 0.1, type: OscillatorType = 'sine') => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignore audio policy
    }
  }, [soundEnabled]);

  // WebSocket Live Updates
  const { isConnected: isWsConnected } = useShipmentWebSocket(1, (data) => {
    if (!data) return;
    if (data.type === 'telemetry' || data.temperature !== undefined) {
      const nowStr = new Date().toTimeString().split(' ')[0];
      const tempVal = Number(data.temperature ?? packageTemp);
      setPackageTemp(tempVal);
      setLastReceivedTime(`${nowStr} UTC`);
      setServerTimestamp(data.timestamp || nowStr);
      setPacketsCount((prev) => prev + 1);

      if (data.battery !== undefined) setBatteryPct(data.battery);
      if (data.rssi !== undefined) setRssiDbm(data.rssi);

      if (data.predicted_temp !== undefined) {
        setPredictedTemp(data.predicted_temp);
        if (data.predicted_temp >= tempMaxLimit) {
          setIsBreached(true);
          setRiskLevel('CRITICAL');
        } else if (data.predicted_temp >= tempMaxLimit - 0.5) {
          setIsBreached(false);
          setRiskLevel('ELEVATED');
        } else {
          setIsBreached(false);
          setRiskLevel('NORMAL');
        }
      }

      if (data.tray_state) {
        setTrayState(data.tray_state);
        if (data.tray_state === 'PROTECTED') setTrayPosition(100);
        else if (data.tray_state === 'EXTENDED') setTrayPosition(0);
      }

      // Append chart point
      setChartData((prev) => {
        const nextPt: ChartPoint = {
          time: nowStr.slice(0, 5),
          packageTemp: tempVal,
          coldTemp: coldTemp,
          limit: tempMaxLimit,
        };
        const sliced = prev.length > 12 ? prev.slice(1) : prev;
        return [...sliced, nextPt];
      });
    }

    if (data.alert) {
      setEvents((prev) => [
        {
          id: Date.now().toString(),
          time: new Date().toTimeString().split(' ')[0],
          type: data.alert.severity === 'CRITICAL' ? 'red' : 'amber',
          message: data.alert.message || 'Telemetry threshold exceeded',
          isNew: true,
        },
        ...prev.slice(0, 7),
      ]);
    }
  });

  // Clock Update
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockTime(now.toTimeString().split(' ')[0]);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Smooth Motor Motion Interpolation
  useEffect(() => {
    if (isEmergencyStopped) {
      setIsTrayMoving(false);
      setTrayState('ERROR');
      return;
    }

    if (trayPosition === trayTarget) {
      setIsTrayMoving(false);
      setMotorCurrentMa(180);
      if (trayPosition >= 90) {
        setTrayState('PROTECTED');
      } else if (trayPosition <= 10) {
        setTrayState('EXTENDED');
      }
      return;
    }

    setIsTrayMoving(true);
    setActiveHwStage('SERVO');
    setMotorCurrentMa(650);
    setTrayState(trayTarget > trayPosition ? 'MOVING_IN' : 'MOVING_OUT');

    const stepSize = (trayTarget > trayPosition ? 4 : -4) * simSpeed;
    const timer = setTimeout(() => {
      setTrayPosition((pos) => {
        const next = pos + stepSize;
        if ((stepSize > 0 && next >= trayTarget) || (stepSize < 0 && next <= trayTarget)) {
          playBeep(440, 0.08);
          return trayTarget;
        }
        return next;
      });
    }, 40);

    return () => clearTimeout(timer);
  }, [trayPosition, trayTarget, simSpeed, playBeep, isEmergencyStopped]);

  // Automated Hardware Pipeline Sequencer (Continuous Loop through 6 Steps in Sim Mode)
  useEffect(() => {
    if (!isPlaying || !isAutoWalkthrough || dataSource === 'LIVE') return;

    let stepDuration = 2800 / simSpeed;
    if (activeStep === 6) {
      stepDuration = 4500 / simSpeed;
    } else if (activeStep === 5) {
      stepDuration = 3400 / simSpeed;
    }

    const timer = setTimeout(() => {
      if (activeStep === 1) {
        setActiveStep(2);
        setActiveHwStage('GATEWAY');
        setPacketsCount((prev) => prev + 1);
        playBeep(640, 0.08);
      } else if (activeStep === 2) {
        setActiveStep(3);
        setActiveHwStage('LAPTOP_AI');
        setPackageTemp(7.9);
        setPredictedTemp(8.3);
        setIsBreached(true);
        setRiskLevel('CRITICAL');
        setAiDecision('Move to Cooling');
        playBeep(880, 0.15, 'sawtooth');
      } else if (activeStep === 3) {
        setActiveStep(4);
        setActiveHwStage('ESP32');
        playBeep(720, 0.08);
      } else if (activeStep === 4) {
        setActiveStep(5);
        setActiveHwStage('SERVO');
        setTrayTarget(100);
        playBeep(550, 0.1);
      } else if (activeStep === 5) {
        setActiveStep(6);
        setActiveHwStage('COLD_CHAMBER');
        setTrayPosition(100);
        setPackageTemp(5.4);
        setIsBreached(false);
        setRiskLevel('NORMAL');
        setAiDecision('Protected in Cooling');
        playBeep(1040, 0.2, 'triangle');
      } else if (activeStep === 6) {
        setActiveStep(1);
        setActiveHwStage('BEACON');
        setTrayTarget(0);
        setPackageTemp(7.2);
        setPredictedTemp(7.6);
        setIsBreached(false);
        setRiskLevel('NORMAL');
        setAiDecision('Monitoring (Normal)');
        playBeep(480, 0.1);
      }
    }, stepDuration);

    return () => clearTimeout(timer);
  }, [isPlaying, isAutoWalkthrough, activeStep, simSpeed, playBeep, dataSource]);

  // Telemetry physics in SIMULATED mode
  useEffect(() => {
    if (!isPlaying || dataSource === 'LIVE') return;

    const intervalTime = Math.max(300, 1000 / simSpeed);

    const interval = setInterval(() => {
      setPacketsCount((prev) => prev + 1);

      setColdTemp((prev) => {
        const next = 3.2 + (Math.random() - 0.5) * 0.15;
        return Number(next.toFixed(1));
      });

      setPackageTemp((prev) => {
        let delta = 0;
        if (trayPosition >= 80) {
          delta = -0.06 * (prev - 4.2);
        } else if (trayPosition <= 20) {
          delta = 0.04 * (ambientTemp - prev);
        } else {
          delta = 0.01;
        }

        delta += (Math.random() - 0.5) * 0.03;
        const newTemp = Math.max(2.8, Math.min(32.0, prev + delta));
        const rounded = Number(newTemp.toFixed(2));

        const slope = delta * 15;
        const pred = Number((newTemp + slope * 1.8).toFixed(1));
        setPredictedTemp(pred);

        if (pred >= tempMaxLimit) {
          setIsBreached(true);
          setRiskLevel('CRITICAL');
          if (isAutonomous && trayPosition < 50 && !isTrayMoving && !isEmergencyStopped) {
            setActiveHwStage('LAPTOP_AI');
            setTimeout(() => setActiveHwStage('ESP32'), 400);

            setTrayTarget(100);
            setActiveStep(3);
            const nowTime = new Date().toTimeString().split(' ')[0];
            setAiDecision('Move to Cooling');
            setDecisionTime(nowTime);

            playBeep(980, 0.2, 'triangle');

            const autoEvent: EventItem = {
              id: Date.now().toString(),
              time: nowTime,
              type: 'blue',
              message: `Autonomous Protection: Laptop AI commanded ESP32 to retract Sliding Tray into Cold Compartment!`,
              isNew: true,
            };
            setEvents((evs) => [autoEvent, ...evs.slice(0, 7)]);
          }
        } else if (pred >= tempMaxLimit - 0.5) {
          setIsBreached(false);
          setRiskLevel('ELEVATED');
        } else {
          setIsBreached(false);
          setRiskLevel('NORMAL');
          if (trayPosition >= 90) {
            setAiDecision('Protected in Cooling');
            setActiveStep(5);
          } else {
            setAiDecision('Monitoring (Normal)');
            setActiveStep(2);
          }
        }

        if (Math.random() < 0.35) {
          const nowStr = new Date().toTimeString().split(' ')[0].slice(0, 5);
          setChartData((prevData) => {
            const nextPoint: ChartPoint = {
              time: nowStr,
              packageTemp: rounded,
              coldTemp: 3.2,
              limit: 8.0,
            };
            const sliced = prevData.length > 10 ? prevData.slice(1) : prevData;
            return [...sliced, nextPoint];
          });
        }

        return rounded;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isPlaying, simSpeed, trayPosition, ambientTemp, tempMaxLimit, isAutonomous, isTrayMoving, playBeep, dataSource, isEmergencyStopped]);

  // Actions
  const handleTriggerExcursion = async () => {
    playBeep(880, 0.25, 'sawtooth');
    setIsAutoWalkthrough(false);

    setTrayTarget(0);
    setAmbientTemp(28.0);
    setPackageTemp(7.9);
    setPredictedTemp(8.6);
    setIsBreached(true);
    setRiskLevel('CRITICAL');
    setActiveStep(1);
    setActiveHwStage('BEACON');

    const nowTime = new Date().toTimeString().split(' ')[0];
    const excursionEvent: EventItem = {
      id: Date.now().toString(),
      time: nowTime,
      type: 'red',
      message: `Thermal Excursion Injected! KKM K6 Beacon broadcasting rising temp: 7.9°C (Predicted: 8.6°C).`,
      isNew: true,
    };
    setEvents((prev) => [excursionEvent, ...prev.slice(0, 7)]);

    try {
      api.simulatorTriggerExcursion(1).catch(() => {});
    } catch {}

    if (isAutonomous && !isEmergencyStopped) {
      setTimeout(() => {
        playBeep(1200, 0.3, 'triangle');
        setActiveHwStage('LAPTOP_AI');

        const triggerTime = new Date().toTimeString().split(' ')[0];
        setAiDecision('Move to Cooling');
        setDecisionTime(triggerTime);
        setActiveStep(3);

        const aiEvent: EventItem = {
          id: (Date.now() + 1).toString(),
          time: triggerTime,
          type: 'blue',
          message: `Laptop AI Model detected breach -> Transmitting USB Serial command to ESP32 Controller.`,
          isNew: true,
        };
        setEvents((prev) => [aiEvent, ...prev.slice(0, 7)]);

        setTimeout(() => {
          setActiveHwStage('ESP32');
          setActiveStep(4);
          setTrayTarget(100);

          setTimeout(() => {
            setActiveHwStage('SERVO');
            setActiveStep(5);

            setTimeout(() => {
              setActiveHwStage('COLD_CHAMBER');
              setActiveStep(6);
              setAmbientTemp(22.5);

              const protectedEvent: EventItem = {
                id: (Date.now() + 2).toString(),
                time: new Date().toTimeString().split(' ')[0],
                type: 'green',
                message: `Package arrived inside Insulated Cold Compartment (+ Cold Pack). Limit switch LS2 confirmed.`,
                isNew: true,
              };
              setEvents((prev) => [protectedEvent, ...prev.slice(0, 7)]);
            }, 3000);
          }, 600);
        }, 800);
      }, 1500);
    }
  };

  const handleReset = () => {
    playBeep(600, 0.1);
    setIsEmergencyStopped(false);
    setPackageTemp(7.2);
    setPredictedTemp(7.6);
    setAmbientTemp(22.5);
    setColdTemp(3.2);
    setTrayTarget(0);
    setTrayPosition(0);
    setTrayState('EXTENDED');
    setActiveStep(1);
    setActiveHwStage('BEACON');
    setRiskLevel('NORMAL');
    setAiDecision('Monitoring (Normal)');
    setDecisionTime(new Date().toTimeString().split(' ')[0]);
    setIsBreached(false);
    setIsAutoWalkthrough(true);
  };

  const toggleTrayTarget = () => {
    if (isEmergencyStopped) return;
    playBeep(520, 0.1);
    const newTarget = trayTarget === 100 ? 0 : 100;
    setTrayTarget(newTarget);
    if (newTarget === 0) {
      setActiveStep(2);
      setActiveHwStage('BEACON');
      setAiDecision('Extended in Ambient');
      api.moveTrayOut(1).catch(() => {});
    } else {
      setActiveStep(3);
      setActiveHwStage('ESP32');
      setAiDecision('Moving to Cooling');
      api.moveTrayIn(1).catch(() => {});
    }
  };

  // Hardware Emergency Stop
  const handleEmergencyStop = async () => {
    playBeep(320, 0.4, 'sawtooth');
    setIsEmergencyStopped(true);
    setIsTrayMoving(false);
    setTrayState('ERROR');
    setMotorCurrentMa(0);

    const nowTime = new Date().toTimeString().split(' ')[0];
    const estopEvent: EventItem = {
      id: Date.now().toString(),
      time: nowTime,
      type: 'red',
      message: 'EMERGENCY STOP ENGAGED: Motor power interlocked. Actuation halted at position ' + Math.round(trayPosition) + '%.',
      isNew: true,
    };
    setEvents((prev) => [estopEvent, ...prev.slice(0, 7)]);

    try {
      await api.emergencyStopTray(1);
    } catch {}
  };

  // Manual Operator Override
  const handleManualOverride = async (target: number) => {
    playBeep(580, 0.15);
    setIsEmergencyStopped(false);
    setTrayTarget(target);
    const nowTime = new Date().toTimeString().split(' ')[0];
    const overrideEvent: EventItem = {
      id: Date.now().toString(),
      time: nowTime,
      type: 'amber',
      message: `Manual Operator Override: Driving sliding tray carriage to ${target}% target position.`,
      isNew: true,
    };
    setEvents((prev) => [overrideEvent, ...prev.slice(0, 7)]);

    try {
      await api.overrideTray(1, target, 'Operator manual live command override');
    } catch {}
  };

  const getPackageLocation = () => {
    if (trayPosition >= 90) {
      return {
        label: 'Inside Insulated Cold Compartment (+ Reusable Cold Pack)',
        sub: 'Securely docked in insulated cold-pack enclosure (Cold Chamber: 3.2°C, PUR Barrier Active)',
        status: 'CHAMBER_PROTECTED',
        color: 'text-cyan-700 bg-cyan-50 border-cyan-300',
        dot: 'bg-cyan-500',
      };
    } else if (trayPosition <= 10) {
      return {
        label: 'External Ambient Dispatch Track (Exposed)',
        sub: 'Station STN-PK4 Packaging Line Track (Ambient Air: 22.5°C, Risk of Excursion)',
        status: 'AMBIENT_EXPOSED',
        color: 'text-amber-800 bg-amber-50 border-amber-300',
        dot: 'bg-amber-500',
      };
    } else {
      return {
        label: 'In Transit on Sliding Tray Linear Rails',
        sub: `Servo moving carriage along linear rail guide at 12 mm/s (Position: ${Math.round(trayPosition)}%)`,
        status: 'TRANSIT_MOTION',
        color: 'text-blue-800 bg-blue-50 border-blue-300',
        dot: 'bg-blue-500',
      };
    }
  };

  const pkgLoc = getPackageLocation();

  const selectedGateway = gateways.find((g) => g.id === Number(selectedGatewayId)) || gateways[0];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 font-sans select-none">
      {/* ========================================================================= */}
      {/* 0. B2B ENTERPRISE CONTROL & GATEWAY HEADER BAR                            */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Pipeline Mode & Gateway Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Live vs Simulated Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setDataSource('LIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                dataSource === 'LIVE'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${dataSource === 'LIVE' ? 'bg-white animate-pulse' : 'bg-emerald-500'}`}></span>
              <span>LIVE BLE STREAM</span>
            </button>
            <button
              onClick={() => setDataSource('SIMULATED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                dataSource === 'SIMULATED'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>SIMULATED RIG</span>
            </button>
          </div>

          {/* Gateway Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <Radio className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-slate-500 font-medium">Gateway:</span>
            <select
              value={selectedGatewayId}
              onChange={(e) => setSelectedGatewayId(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              {gateways.map((gw) => (
                <option key={gw.id} value={gw.id}>
                  {gw.name} ({gw.gateway_identifier || gw.adapter_type})
                </option>
              ))}
            </select>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
              ● {selectedGateway?.status || 'CONNECTED'}
            </span>
          </div>

          {/* BLE Device Tag */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <HardDrive className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-slate-500 font-medium">Device:</span>
            <span className="font-mono font-bold text-slate-800">{selectedDeviceMac}</span>
            <span className="text-[10px] text-slate-500 font-mono">({rssiDbm} dBm | Batt: {batteryPct}%)</span>
          </div>
        </div>

        {/* Right: Realtime status, Emergency Stop, Settings Link */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* WebSocket status pill */}
          <div className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 border ${
            isWsConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`}></span>
            <span>{isWsConnected ? 'WS LIVE' : 'WS RECONNECTING'}</span>
          </div>

          {/* Hardware Emergency Stop */}
          <button
            onClick={handleEmergencyStop}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all active:scale-95 shadow-xs ${
              isEmergencyStopped
                ? 'bg-red-700 text-white border-red-800 animate-pulse'
                : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-300'
            }`}
            title="Actuator Emergency Stop Interlock"
          >
            <AlertOctagon className="w-3.5 h-3.5 fill-red-600 text-white" />
            <span>{isEmergencyStopped ? 'E-STOP ACTIVE' : 'EMERGENCY STOP'}</span>
          </button>

          {/* Configure Gateways Link */}
          <Link
            href="/settings/gateways"
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all flex items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            <span>Gateways</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TOP METRIC STATS ROW (5 Cards)                                        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Package Temperature */}
        <div className={`bg-white rounded-xl p-4 border transition-all duration-300 shadow-xs hover:shadow-sm ${
          isBreached ? 'border-red-300 ring-2 ring-red-100 bg-red-50/20' : 'border-slate-200/90'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                isBreached ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'
              }`}>
                <Thermometer className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600">Current Temperature</div>
                <div className="text-[10px] text-slate-400 font-mono">Limit: {tempMinLimit.toFixed(1)}° - {tempMaxLimit.toFixed(1)}°C</div>
              </div>
            </div>
            {isBreached ? (
              <span className="animate-pulse text-[10px] font-bold text-red-600 px-1.5 py-0.5 rounded bg-red-100">
                EXCURSION
              </span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-700 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                OPTIMAL
              </span>
            )}
          </div>
          <div className={`text-3xl font-extrabold tracking-tight pl-1 font-mono transition-colors ${
            isBreached ? 'text-red-600' : 'text-slate-900'
          }`}>
            {packageTemp.toFixed(1)} <span className="text-lg font-normal text-slate-500">°C</span>
          </div>
          <div className="flex items-center justify-between mt-2 pl-1 text-[11px]">
            <span className="text-slate-500 font-mono">Rx: {lastReceivedTime}</span>
            <span className={`font-semibold ${isBreached ? 'text-red-600' : 'text-emerald-600'}`}>
              {trayPosition >= 90 ? 'Protected' : 'Ambient Air'}
            </span>
          </div>
        </div>

        {/* Card 2: AI Excursion Forecast */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Cpu className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600">AI Forecast (+{forecastHorizon})</div>
                <div className="text-[10px] text-slate-400 font-mono">Ridge Regr. v1.2</div>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              riskLevel === 'CRITICAL'
                ? 'bg-red-100 text-red-700 animate-pulse'
                : riskLevel === 'ELEVATED'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {riskLevel}
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight pl-1 font-mono">
            {predictedTemp.toFixed(1)} <span className="text-lg font-normal text-slate-500">°C</span>
          </div>
          <div className="flex items-center justify-between mt-2 pl-1 text-[11px] text-slate-500">
            <span>Horizon: <strong className="text-indigo-700 font-mono">15m</strong></span>
            <span className="font-semibold text-slate-700">{aiDecision}</span>
          </div>
        </div>

        {/* Card 3: Cold Compartment */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-full bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600">
              <Snowflake className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">Cold Chamber (+Ice Pack)</div>
              <div className="text-[10px] text-cyan-700 font-mono">PUR Vacuum Enclosure</div>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight pl-1 font-mono">
            {coldTemp.toFixed(1)} <span className="text-lg font-normal text-slate-500">°C</span>
          </div>
          <div className="flex items-center justify-between mt-2 pl-1 text-[11px]">
            <span className="text-cyan-700 font-medium">Ambient: {ambientTemp.toFixed(1)}°C</span>
            <span className="text-slate-400 font-mono">Delta: -19.3°C</span>
          </div>
        </div>

        {/* Card 4: Motorized Tray State */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Layers className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="text-xs font-semibold text-slate-600">Tray Actuator State</div>
            </div>
            <span className={`font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
              trayState === 'PROTECTED'
                ? 'bg-cyan-100 text-cyan-800'
                : trayState === 'EXTENDED'
                ? 'bg-amber-100 text-amber-800'
                : trayState === 'ERROR'
                ? 'bg-red-100 text-red-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {trayState}
            </span>
          </div>
          <div className="text-xl font-extrabold text-slate-900 tracking-tight pl-1">
            {trayPosition >= 90 ? 'Docked in Cold' : trayPosition <= 10 ? 'Extended Ambient' : 'Moving Rails...'}
          </div>
          <div className="mt-2 pl-1 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>LS1: {trayPosition <= 5 ? 'CLOSED' : 'OPEN'}</span>
              <span>LS2: {trayPosition >= 95 ? 'CLOSED' : 'OPEN'}</span>
              <strong className="text-blue-700">{Math.round(trayPosition)}%</strong>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div
                className="h-full bg-linear-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-150"
                style={{ width: `${trayPosition}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Card 5: Gateway Status */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                <Wifi className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600">Gateway Link</div>
                <div className="text-[10px] text-teal-700 font-mono">{dataSource}</div>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight pl-1">
            Connected
          </div>
          <div className="text-[11px] font-medium text-slate-500 mt-2 pl-1 flex items-center justify-between">
            <span>Packets: <strong className="font-mono text-slate-700">{packetsCount} rx</strong></span>
            <span className="font-mono text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
              {batteryPct}% batt
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. DEDICATED PACKAGE LOCATOR BANNER ("WHERE IS THE PACKAGE?")             */}
      {/* ========================================================================= */}
      <div className={`rounded-xl border p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-all ${pkgLoc.color}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/90 shadow-xs border border-current flex items-center justify-center text-blue-600 shrink-0">
            <Box className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/80 px-2 py-0.5 rounded-full border border-current">
                📍 Live Package Location Tracker
              </span>
              <span className={`w-2 h-2 rounded-full ${pkgLoc.dot} animate-ping`}></span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/70 border border-current font-bold">
                DATA: {dataSource}
              </span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
              {pkgLoc.label}
            </h3>
            <p className="text-xs text-slate-600 font-medium">
              {pkgLoc.sub}
            </p>
          </div>
        </div>

        {/* Live Coordinate Badges */}
        <div className="flex items-center gap-2 text-xs font-mono bg-white/90 px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs shrink-0">
          <span className="text-slate-500">STATE:</span>
          <strong className="text-blue-700">{trayState}</strong>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">CARRIAGE:</span>
          <strong className="text-slate-900">{Math.round(trayPosition)}%</strong>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">PAYLOAD:</span>
          <strong className={packageTemp > 8.0 ? 'text-red-600 font-extrabold' : 'text-emerald-700'}>
            {packageTemp.toFixed(1)}°C
          </strong>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MIDDLE SECTION: PHYSICAL RIG STAGE + TREND CHART                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: INTERACTIVE HARDWARE RIG (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
          <div>
            {/* Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <h2 className="text-base font-bold text-slate-900">Physical Hardware Rig &amp; Package View</h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  See where the package is positioned and watch the linear carriage move between bays
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Speed Multiplier */}
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
                  {[1, 2, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSimSpeed(s)}
                      className={`px-2 py-1 rounded-md transition-all ${
                        simSpeed === s ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                {/* Sound Toggle */}
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-lg border text-xs transition-colors ${
                    soundEnabled ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                  title={soundEnabled ? 'Mute Audio Feedback' : 'Enable Hardware Audio Feedback'}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>

                {/* Simulate Excursion Button */}
                <button
                  onClick={handleTriggerExcursion}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500 animate-pulse" />
                  <span>Simulate Excursion</span>
                </button>

                {/* Manual Override Tray Buttons */}
                <button
                  onClick={() => handleManualOverride(trayTarget === 100 ? 0 : 100)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-600" />
                  <span>{trayTarget === 100 ? 'Extend OUT (0%)' : 'Retract IN (100%)'}</span>
                </button>

                {/* Reset Button */}
                <button
                  onClick={handleReset}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors active:scale-95"
                  title="Reset Demo"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Live / Paused */}
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow-xs transition-colors active:scale-95 ${
                    isPlaying ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {isPlaying ? <Pause className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white" />}
                  <span>{isPlaying ? 'Live' : 'Paused'}</span>
                </button>
              </div>
            </div>

            {/* DYNAMIC PHYSICAL MACHINE STAGE */}
            <div className="relative my-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video flex flex-col justify-between p-4 shadow-inner">
              {/* Background Grid */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px)`,
                  backgroundSize: '24px 24px',
                }}
              ></div>

              {/* Machine Top Banner Info */}
              <div className="relative z-10 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-mono text-[11px] text-slate-400">HARDWARE RIG: <strong className="text-white">D4 AUTOMATED ENCLOSURE</strong></span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-slate-400">ESP32 PWM:</span>
                  <span className="text-cyan-400 font-bold">{Math.round(1000 + trayPosition * 10)} µs</span>
                  <span className="text-slate-400">({motorCurrentMa} mA)</span>
                </div>
              </div>

              {/* Machine Rails & Compartments */}
              <div className="relative z-10 w-full my-auto py-4">
                <div className="relative h-44 bg-slate-800/80 rounded-xl border border-slate-700/80 p-3 flex items-center justify-between overflow-hidden backdrop-blur-xs">
                  {/* Left Section: Ambient Track Guide */}
                  <div className="w-[58%] h-full flex flex-col justify-between relative pr-4">
                    {/* Stepper Motor On Left */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-20 bg-slate-700 rounded-lg border border-slate-600 flex flex-col items-center justify-center shadow-lg">
                      <div className={`w-4 h-4 rounded-full border-2 border-slate-400 flex items-center justify-center ${
                        isTrayMoving ? 'animate-spin' : ''
                      }`}>
                        <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                      </div>
                      <span className="text-[7px] text-slate-400 font-mono mt-1 font-bold">SERVO</span>
                    </div>

                    {/* Dual Silver Anodized Rails */}
                    <div className="absolute left-10 right-4 top-1/2 -translate-y-1/2 space-y-3 pointer-events-none">
                      <div className="h-2 bg-linear-to-b from-slate-300 to-slate-500 rounded-full shadow-inner border border-slate-400"></div>
                      <div className="h-1 bg-slate-900 rounded-full"></div>
                      <div className="h-2 bg-linear-to-b from-slate-300 to-slate-500 rounded-full shadow-inner border border-slate-400"></div>
                    </div>

                    {/* Ambient Track Label */}
                    <div className="absolute top-1 left-12 text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                      <span>STAGE 1 &amp; 5: DISPATCH SLIDE TRACK (AMBIENT)</span>
                    </div>

                    {/* Limit Switch 1 (Home) */}
                    <div className="absolute left-10 bottom-1 flex items-center gap-1 text-[9px] font-mono">
                      <span className={`w-1.5 h-1.5 rounded-full ${trayPosition <= 5 ? 'bg-emerald-400 ring-2 ring-emerald-300' : 'bg-slate-600'}`}></span>
                      <span className="text-slate-400">LS1 (HOME EXTENDED)</span>
                    </div>
                  </div>

                  {/* Right Section: Insulated Cold Compartment + Cold Pack */}
                  <div className="w-[40%] h-full bg-linear-to-br from-blue-950/90 to-cyan-950/90 rounded-lg border-2 border-cyan-500/50 relative p-2.5 flex flex-col justify-between overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 bg-cyan-500/10 animate-pulse pointer-events-none"></div>

                    {/* Compartment Header */}
                    <div className="flex items-center justify-between text-[10px] font-bold text-cyan-300 relative z-10">
                      <div className="flex items-center gap-1.5">
                        <Snowflake className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '8s' }} />
                        <span>INSULATED COLD COMPARTMENT</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded bg-cyan-900/80 border border-cyan-400/40 text-[9px] font-mono text-cyan-200">
                        {coldTemp.toFixed(1)}°C
                      </span>
                    </div>

                    {/* Cold Packs */}
                    <div className="grid grid-cols-2 gap-1.5 my-1 relative z-10">
                      <div className="h-9 rounded bg-cyan-500/30 border border-cyan-400/40 flex items-center justify-center text-[9px] text-cyan-200 font-mono shadow-inner">
                        ❄ REUSABLE COLD PACK 1
                      </div>
                      <div className="h-9 rounded bg-cyan-500/30 border border-cyan-400/40 flex items-center justify-center text-[9px] text-cyan-200 font-mono shadow-inner">
                        ❄ REUSABLE COLD PACK 2
                      </div>
                    </div>

                    {/* Limit Switch 2 (Chamber Position Feedback) */}
                    <div className="flex items-center justify-between text-[9px] font-mono text-cyan-400 relative z-10">
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${trayPosition >= 95 ? 'bg-emerald-400 ring-2 ring-emerald-300' : 'bg-slate-600'}`}></span>
                        <span>LS2 (CHAMBER POSITION FEEDBACK)</span>
                      </div>
                      <span className="text-[9px] text-emerald-300 font-bold">PUR INSULATION</span>
                    </div>
                  </div>

                  {/* ============================================================= */}
                  {/* THE PHYSICAL SLIDING TRAY & PACKAGE CARRIAGE                  */}
                  {/* ============================================================= */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 transition-transform duration-75 z-30 pointer-events-none"
                    style={{
                      left: `calc(48px + ${trayPosition * 0.58}%)`,
                    }}
                  >
                    <div className="relative">
                      {/* Floating Pointer: "WHERE IS THE PACKAGE" */}
                      <div className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1.5 shadow-xl border backdrop-blur-md transition-all ${
                          isBreached
                            ? 'bg-red-950/95 text-red-200 border-red-500 ring-2 ring-red-400/50 animate-bounce'
                            : 'bg-slate-900/95 text-cyan-300 border-cyan-500/60'
                        }`}>
                          <MapPin className="w-3 h-3 text-red-400" />
                          <span>PACKAGE HERE: <strong className="font-mono text-white text-xs">{packageTemp.toFixed(1)}°C</strong></span>
                        </div>
                      </div>

                      {/* KKM K6 BLE Beacon Tag (Mounted on Package) */}
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center justify-center">
                        <span className="relative flex h-3.5 w-3.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500 items-center justify-center text-[7px] text-black font-extrabold">
                            K6
                          </span>
                        </span>
                      </div>

                      {/* The Medicine Package Box */}
                      <div className="w-24 h-18 bg-white rounded-md border-2 border-blue-400 p-1.5 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-[7px] font-extrabold text-blue-800 leading-none">BIOPHARMA</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        </div>
                        <div className="text-center my-0.5">
                          <div className="text-[8px] font-black text-slate-900 leading-tight">VAS-PROTECT</div>
                          <div className="text-[6.5px] font-mono text-blue-700 font-bold">VACCINE 2°C-8°C</div>
                        </div>
                        <div className="flex items-center justify-between text-[6px] font-mono text-slate-500 border-t border-slate-200 pt-0.5">
                          <span>KKM K6 BEACON</span>
                          <span>STN-PK4</span>
                        </div>
                      </div>

                      {/* Sliding Tray Metal Carriage on Rail */}
                      <div className="w-28 -ml-2 h-3 bg-linear-to-b from-slate-400 to-slate-600 rounded-sm border border-slate-500 shadow-md flex justify-between px-1 items-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-900"></div>
                        <div className="text-[7px] font-mono text-slate-200 font-bold">SLIDING TRAY</div>
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-900"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Bar */}
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    trayPosition >= 90
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      : isTrayMoving
                      ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}>
                    STATE: {trayState}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Pos: <strong className="text-white font-mono">{Math.round(trayPosition)}%</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">MANUAL POS:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={trayTarget}
                    onChange={(e) => {
                      setTrayTarget(Number(e.target.value));
                      playBeep(480, 0.05);
                    }}
                    className="w-24 sm:w-36 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-[10px] font-mono text-cyan-400 font-bold w-7">{trayTarget}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stepper Milestones Progress Bar (5 Steps) */}
          <div className="pt-3 border-t border-slate-100">
            <div className="grid grid-cols-5 text-center relative">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  activeStep >= 1 ? 'bg-emerald-500 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                }`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold text-slate-800 mt-1.5 leading-tight">Package Detected</span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">14:28:05</span>
              </div>

              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  activeStep >= 2 ? 'bg-emerald-500 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                }`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold text-slate-800 mt-1.5 leading-tight">Monitoring Temperature</span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">14:28:15</span>
              </div>

              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-blue-100 transition-all ${
                  activeStep >= 3 ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                }`}>
                  <Snowflake className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold text-blue-700 mt-1.5 leading-tight">Moved to Cooling</span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">{decisionTime}</span>
              </div>

              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  activeStep >= 4 ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-400 border border-slate-300'
                }`}>
                  <Snowflake className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 mt-1.5 leading-tight">Cooling in Progress</span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">{activeStep >= 4 ? 'ACTIVE' : '–'}</span>
              </div>

              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  activeStep >= 5 ? 'bg-emerald-500 text-white shadow-xs' : 'bg-slate-100 text-slate-400 border border-slate-300'
                }`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 mt-1.5 leading-tight">Stable Temperature</span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">{activeStep >= 5 ? 'VERIFIED' : '–'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TREND GRAPH & AI PREDICTION (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Card 1: Live Temperature Trend Chart */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Live Temperature Trend</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  STREAMING
                </span>
                <select
                  value={simSpeed}
                  onChange={(e) => setSimSpeed(Number(e.target.value))}
                  className="text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-md px-2 py-1 font-medium focus:outline-hidden"
                >
                  <option value={1}>1x Normal</option>
                  <option value={2}>2x Fast</option>
                  <option value={5}>5x Turbo</option>
                </select>
              </div>
            </div>

            {/* Custom Chart Legend */}
            <div className="flex items-center justify-between text-[11px] text-slate-600 px-1 py-1">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-blue-600 rounded"></span>
                <span>Package Temp ({packageTemp.toFixed(1)}°C)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-amber-500"></span>
                <span>Limit (8.0°C)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-500 rounded"></span>
                <span>Cold Chamber (3.2°C)</span>
              </div>
            </div>

            {/* Interactive Trend Chart */}
            <div className="h-44 w-full relative mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[2, 11]}
                    ticks={[2, 4, 6, 8, 10]}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    unit="°C"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      fontSize: '11px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <ReferenceLine y={8.0} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Limit (8.0°C)', fill: '#d97706', fontSize: 9, position: 'insideTopLeft' }} />
                  <Line
                    type="monotone"
                    dataKey="coldTemp"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="packageTemp"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#2563eb' }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Floating Prediction Triggered Callout Badge */}
              {isBreached && (
                <div className="absolute top-1 right-[20%] bg-red-50 border border-red-300 text-red-700 px-2.5 py-1 rounded-md text-[10px] font-extrabold shadow-md flex items-center gap-1.5 animate-bounce">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
                  <span>PREDICTION TRIGGERED ({packageTemp.toFixed(1)}°C &rarr; {predictedTemp.toFixed(1)}°C)</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: AI Prediction & Automated Decision */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">AI Prediction Engine</h3>
                </div>
                <button
                  onClick={() => setIsAutonomous(!isAutonomous)}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded border transition-colors ${
                    isAutonomous
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                  title="Toggle Autonomous Decision Actuation"
                >
                  {isAutonomous ? '🤖 Auto-Pilot ON' : '🎮 Manual Override'}
                </button>
              </div>

              <div className="grid grid-cols-12 gap-3 items-center">
                {/* Metric values */}
                <div className="col-span-6 space-y-2">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">Current Temp</div>
                    <div className={`text-xl font-bold font-mono transition-colors ${
                      packageTemp > 8.0 ? 'text-red-600' : 'text-slate-900'
                    }`}>
                      {packageTemp.toFixed(2)} °C
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">Predicted ({forecastHorizon})</div>
                    <div className={`text-xl font-black font-mono transition-colors ${
                      predictedTemp >= 8.0 ? 'text-red-600 animate-pulse' : 'text-emerald-600'
                    }`}>
                      {predictedTemp.toFixed(1)} °C
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">Limit Boundary</div>
                    <div className="text-sm font-bold text-slate-800 font-mono">{tempMaxLimit.toFixed(1)} °C</div>
                  </div>
                </div>

                {/* Decision box */}
                <div className={`col-span-6 border rounded-xl p-3.5 text-center flex flex-col items-center justify-center shadow-xs transition-all ${
                  isBreached
                    ? 'bg-red-50 border-red-300 ring-2 ring-red-200'
                    : 'bg-emerald-50/80 border-emerald-200'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 shadow-xs text-white ${
                    isBreached ? 'bg-red-600 animate-bounce' : 'bg-emerald-500'
                  }`}>
                    {isBreached ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />}
                  </div>
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${
                    isBreached ? 'text-red-800' : 'text-emerald-800'
                  }`}>
                    Decision
                  </div>
                  <div className="text-xs font-black text-slate-900 mt-0.5 leading-tight">
                    {aiDecision}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    {decisionTime}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>scikit-learn Polynomial Ridge (15m)</span>
              <span className="text-emerald-600 font-semibold font-mono">Confidence: 99.4%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. DETAILED HARDWARE STATUS TABLE & LIVE EVENT FEED                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Detailed Hardware Status (All 8 Modules from User Architecture) */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Hardware Component Telemetry</h3>
            </div>
            <Link
              href="/devices"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>Devices</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {/* 1. Beacon on Package */}
            <div className="py-2 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">KKM K6 Beacon (On Package)</span>
                <span className="text-[10px] text-slate-400 font-mono">BLE 5.0 Advert | Batt: {batteryPct}%</span>
              </div>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                activeHwStage === 'BEACON' ? 'bg-blue-100 text-blue-800 animate-pulse' : 'text-emerald-700 bg-emerald-50'
              }`}>
                {activeHwStage === 'BEACON' ? '● BROADCASTING' : `ONLINE (${rssiDbm}dBm)`}
              </span>
            </div>

            {/* 2. Gateway */}
            <div className="py-2 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">GAO 217030 BLE Gateway</span>
                <span className="text-[10px] text-slate-400 font-mono">MQTT Broker Bridge | 1883</span>
              </div>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                activeHwStage === 'GATEWAY' ? 'bg-blue-100 text-blue-800 animate-pulse' : 'text-emerald-700 bg-emerald-50'
              }`}>
                {activeHwStage === 'GATEWAY' ? '● FORWARDING MQTT' : 'CONNECTED'}
              </span>
            </div>

            {/* 3. Laptop / Edge PC */}
            <div className="py-2 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Laptop / Mini PC (AI Engine)</span>
                <span className="text-[10px] text-slate-400 font-mono">Data Processing + Decision Logic</span>
              </div>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                activeHwStage === 'LAPTOP_AI' ? 'bg-purple-100 text-purple-800 animate-pulse' : 'text-slate-700 bg-slate-100'
              }`}>
                {activeHwStage === 'LAPTOP_AI' ? '● AI INFERENCE ACTIVE' : 'HOST RUNNING'}
              </span>
            </div>

            {/* 4. ESP32 Controller */}
            <div className="py-2 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">ESP32 Actuator Controller</span>
                <span className="text-[10px] text-slate-400 font-mono">USB Serial UART (115200 baud)</span>
              </div>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                activeHwStage === 'ESP32' ? 'bg-amber-100 text-amber-800 animate-pulse' : 'text-emerald-700 bg-emerald-50'
              }`}>
                {activeHwStage === 'ESP32' ? '● EXECUTING MOTOR CMD' : 'UART READY'}
              </span>
            </div>

            {/* 5. Servo Motor */}
            <div className="py-2 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Servo Actuator Motor</span>
                <span className="text-[10px] text-slate-400 font-mono">PWM Pin 18 | {motorCurrentMa} mA</span>
              </div>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                isTrayMoving ? 'bg-amber-100 text-amber-800 animate-pulse' : 'text-slate-700 bg-slate-100'
              }`}>
                {isTrayMoving ? '● ROTATING (650mA)' : 'HOLDING (180mA)'}
              </span>
            </div>

            {/* 6. Limit Switches */}
            <div className="py-2 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Limit Switches (LS1, LS2)</span>
                <span className="text-[10px] text-slate-400 font-mono">Position Feedback Loop</span>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded text-emerald-700 bg-emerald-50">
                {trayPosition >= 95 ? 'LS2 CLOSED (100%)' : trayPosition <= 5 ? 'LS1 CLOSED (0%)' : 'BETWEEN STOPS'}
              </span>
            </div>

            {/* 7. Sliding Tray */}
            <div className="py-2 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Sliding Tray Carriage</span>
                <span className="text-[10px] text-slate-400 font-mono">Linear Guide Slider ({Math.round(trayPosition)}%)</span>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded text-blue-700 bg-blue-50">
                {trayPosition >= 90 ? 'IN CHAMBER' : trayPosition <= 10 ? 'IN AMBIENT' : 'SLIDING'}
              </span>
            </div>

            {/* 8. Insulated Cold Compartment */}
            <div className="py-2 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Insulated Cold Compartment</span>
                <span className="text-[10px] text-slate-400 font-mono">+ Reusable Cold Pack ({coldTemp.toFixed(1)}°C)</span>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded text-cyan-800 bg-cyan-100">
                {trayPosition >= 90 ? 'PROTECTING PKG' : 'STANDBY READY'}
              </span>
            </div>
          </div>
        </div>

        {/* Column 2: Recent Events Feed */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Hardware Step Audit Feed</h3>
              <span className="text-[10px] text-emerald-600 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                ● 21 CFR PART 11
              </span>
            </div>

            <div className="space-y-2.5 mt-1 max-h-80 overflow-y-auto pr-1">
              {events.map((ev) => {
                const dotColor =
                  ev.type === 'red'
                    ? 'bg-red-600 animate-ping'
                    : ev.type === 'blue'
                    ? 'bg-blue-600'
                    : ev.type === 'amber'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500';

                return (
                  <div
                    key={ev.id}
                    className={`flex items-start gap-2.5 text-xs p-1.5 rounded transition-colors ${
                      ev.isNew ? 'bg-blue-50/70 border border-blue-200' : ''
                    }`}
                  >
                    <span className="font-mono text-slate-400 text-[11px] shrink-0 w-13">
                      {ev.time}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`}></span>
                    </div>
                    <span className="text-slate-800 font-medium leading-snug">
                      {ev.message}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 text-[10px] text-slate-400 font-mono text-right">
            Encrypted Immutable Event Trail
          </div>
        </div>

        {/* Column 3: System Overview (Radial Gauges) */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">System Health Overview</h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> GxP Compliant
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-2">
              <div className="flex flex-col items-center text-center">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-slate-100" strokeWidth="3.2" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="text-emerald-500 transition-all duration-1000" strokeDasharray="100, 100" strokeWidth="3.2" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <span className="absolute font-extrabold text-slate-900 text-xs">100%</span>
                </div>
                <div className="text-[11px] font-bold text-slate-800 mt-2">Gateway Uptime</div>
                <div className="text-[10px] text-slate-400 font-mono">2d 14h</div>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-slate-100" strokeWidth="3.2" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="text-emerald-500 transition-all duration-1000" strokeDasharray="98, 100" strokeWidth="3.2" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <span className="absolute font-extrabold text-slate-900 text-xs">98%</span>
                </div>
                <div className="text-[11px] font-bold text-slate-800 mt-2">Network Health</div>
                <div className="text-[10px] text-emerald-600 font-semibold">Excellent</div>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-slate-100" strokeWidth="3.2" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="text-blue-600 transition-all duration-1000" strokeDasharray="99, 100" strokeWidth="3.2" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <span className="absolute font-extrabold text-slate-900 text-xs">99%</span>
                </div>
                <div className="text-[11px] font-bold text-slate-800 mt-2">Sensor Quality</div>
                <div className="text-[10px] text-blue-600 font-semibold">Healthy</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400">All cold-chain telemetry parameters within strict GMP limits</span>
          </div>
        </div>
      </div>
    </div>
  );
}
