'use client';

import React from 'react';
import {
  Cpu,
  Box,
  ChevronLeft,
  ChevronRight,
  Zap,
  Flame,
  Play,
  Pause,
  RefreshCw,
} from 'lucide-react';

export type HardwareStageId =
  | 'BEACON'
  | 'GATEWAY'
  | 'LAPTOP_AI'
  | 'ESP32'
  | 'SERVO'
  | 'LIMIT_SWITCHES'
  | 'SLIDING_TRAY'
  | 'COLD_CHAMBER';

export interface StepDetail {
  stepNum: number;
  stageId: HardwareStageId;
  hardwareName: string;
  shortName: string;
  hardwareRole: string;
  hardwareStatus: string;
  protocol: string;
  protocolDetails: string;
  packageLocation: string;
  packageSub: string;
  hasPhysicalPackage: boolean;
  telemetrySummary: string;
  colorTheme: string;
}

export const HARDWARE_STEPS: StepDetail[] = [
  {
    stepNum: 1,
    stageId: 'BEACON',
    hardwareName: 'KKM K6 BLE Temperature Beacon',
    shortName: '1. Beacon',
    hardwareRole: 'Wireless Temperature Sensing Tag',
    hardwareStatus: 'Transmitting 2.4GHz BLE Advertising Packets',
    protocol: 'BLE / KSensor (RF 2.4 GHz)',
    protocolDetails: '1000ms Broadcast Period | -58 dBm RSSI | Battery 98%',
    packageLocation: 'External Ambient Dispatch Track (STN-PK4)',
    packageSub: 'Affixed directly to medicine packaging exposed to ambient air (~22.5°C)',
    hasPhysicalPackage: true,
    telemetrySummary: 'Broadcasting Payload Temp via KSensor format',
    colorTheme: 'blue',
  },
  {
    stepNum: 2,
    stageId: 'GATEWAY',
    hardwareName: 'GAO 217030 BLE Gateway',
    shortName: '2. Gateway',
    hardwareRole: 'Edge IoT Ingestion & Demodulation Gateway',
    hardwareStatus: 'Demodulating 2.4GHz RF & Encapsulating JSON Payload',
    protocol: 'MQTT / JSON (Port 1883 TCP)',
    protocolDetails: 'Forwarding topic: pharma/shipment/STN-PK4/telemetry',
    packageLocation: 'Ambient Dispatch Bay (In RF Range)',
    packageSub: 'Package sensor RF signal picked up by gateway antenna (4.2m line-of-sight)',
    hasPhysicalPackage: false,
    telemetrySummary: 'Forwarding MQTT JSON packet stream to Laptop broker',
    colorTheme: 'teal',
  },
  {
    stepNum: 3,
    stageId: 'LAPTOP_AI',
    hardwareName: 'Laptop / Mini PC (Central AI Core)',
    shortName: '3. Laptop / AI',
    hardwareRole: 'Broker, scikit-learn AI Model & Decision Logic',
    hardwareStatus: 'Evaluating Polynomial Regression Slope & Deciding Action',
    protocol: 'USB Serial (COM3 UART 115200 8N1)',
    protocolDetails: '5 Microservices: Broker + Filter + AI Model + Decision + UI',
    packageLocation: 'Ambient Bay (Thermal Limit Approaching)',
    packageSub: 'AI model projects breach above 8.0°C; initiates automated protection command',
    hasPhysicalPackage: false,
    telemetrySummary: 'AI Forecast Breach -> Transmitting Retraction Serial Command',
    colorTheme: 'purple',
  },
  {
    stepNum: 4,
    stageId: 'ESP32',
    hardwareName: 'ESP32 Controller',
    shortName: '4. ESP32',
    hardwareRole: 'Actuator Motion Controller MCU',
    hardwareStatus: 'Parsing UART Command & Firing 50Hz PWM to Servo',
    protocol: 'PWM (GPIO 18) + Limit Switch GPIO (Pins 19/21)',
    protocolDetails: '50Hz Pulse Train (1000µs -> 2000µs) | Digital Limit Inputs',
    packageLocation: 'Sliding Tray Carriage (Linear Rail Staging)',
    packageSub: 'Package sits on motorized sliding tray; ESP32 MCU energizes servo motor',
    hasPhysicalPackage: false,
    telemetrySummary: 'Commanding Servo PWM: 1520µs | Closed-Loop Loop: Active',
    colorTheme: 'amber',
  },
  {
    stepNum: 5,
    stageId: 'SERVO',
    hardwareName: 'Servo Motor & Limit Switches (Sliding Tray)',
    shortName: '5. Servo & Tray',
    hardwareRole: 'Linear Lead-Screw Drive & Closed-Loop Feedback',
    hardwareStatus: 'Servo Energized; Carriage Traveling on 340mm Linear Rails',
    protocol: 'Mechanical Linear Lead-Screw + Closed-Loop Feedback',
    protocolDetails: '18 mm/s Carriage Velocity | LS1 Open | Contact Feedback Active',
    packageLocation: 'Sliding Tray Linear Rails (In Transit)',
    packageSub: 'Carriage carrying medicine package actively traveling across linear track',
    hasPhysicalPackage: true,
    telemetrySummary: 'Carriage in Motion | Motor Current: 650mA | Entering Airlock',
    colorTheme: 'indigo',
  },
  {
    stepNum: 6,
    stageId: 'COLD_CHAMBER',
    hardwareName: 'Insulated Cold Compartment (+ Reusable Cold Pack)',
    shortName: '6. Cold Bay',
    hardwareRole: 'Hermetic Thermal Isolation Enclosure',
    hardwareStatus: 'Docked & Hermetically Sealed; Rapid Cooling Underway',
    protocol: 'PUR Vacuum Panel Insulation + Reusable Gel Pack',
    protocolDetails: 'LS2 Closed (100% Retracted) | PUR Thermal Vacuum Barrier Active',
    packageLocation: 'Insulated Cold Compartment (+ Reusable Cold Pack)',
    packageSub: 'Medicine package enclosed between dual reusable cold packs at 3.2°C',
    hasPhysicalPackage: true,
    telemetrySummary: 'Chamber: 3.2°C | LS2 Contact Closed | Rapid Heat Absorption',
    colorTheme: 'cyan',
  },
];

interface HardwareArchitectureDiagramProps {
  activeStage: HardwareStageId;
  onSelectStage: (stage: HardwareStageId) => void;
  packageTemp: number;
  ambientTemp: number;
  coldTemp: number;
  predictedTemp: number;
  aiDecision: string;
  trayPosition: number;
  isTrayMoving: boolean;
  packetsCount: number;
  motorCurrentMa: number;
  isBreached: boolean;
  activeStep: number;
  onStepChange?: (step: number) => void;
  onTriggerExcursion?: () => void;
  onTogglePlay?: () => void;
  isPlaying?: boolean;
  isAutoWalkthrough?: boolean;
  onToggleAutoWalkthrough?: () => void;
}

export function HardwareArchitectureDiagram({
  activeStage,
  onSelectStage,
  packageTemp,
  ambientTemp,
  coldTemp,
  predictedTemp,
  aiDecision,
  trayPosition,
  isTrayMoving,
  packetsCount,
  motorCurrentMa,
  isBreached,
  activeStep,
  onStepChange,
  onTriggerExcursion,
  onTogglePlay,
  isPlaying = true,
  isAutoWalkthrough = true,
  onToggleAutoWalkthrough,
}: HardwareArchitectureDiagramProps) {
  // Current active step metadata
  const currentStepIndex = Math.max(
    0,
    HARDWARE_STEPS.findIndex((s) => {
      if (activeStage === 'SERVO' || activeStage === 'LIMIT_SWITCHES' || activeStage === 'SLIDING_TRAY') {
        return s.stageId === 'SERVO';
      }
      return s.stageId === activeStage;
    })
  );
  const currentStepInfo = HARDWARE_STEPS[currentStepIndex] || HARDWARE_STEPS[0];

  // Determine physical location text and color for package
  const getPackageLocationMeta = () => {
    if (trayPosition >= 90) {
      return {
        bay: 'Insulated Cold Compartment',
        sub: 'Docked inside cold chamber (+ Reusable Cold Pack)',
        status: 'SECURE_CHAMBER',
        color: 'text-cyan-800 bg-cyan-50/90 border-cyan-300',
        badgeColor: 'bg-cyan-600 text-white',
        dot: 'bg-cyan-500',
        stageNum: 6,
        tempTarget: coldTemp,
        ambientDelta: 'Protected (-19.3°C vs Ambient)',
      };
    } else if (trayPosition <= 10) {
      return {
        bay: 'External Ambient Dispatch Track',
        sub: 'Exposed to room ambient air (Packaging Line STN-PK4)',
        status: 'AMBIENT_EXPOSED',
        color: 'text-amber-800 bg-amber-50/90 border-amber-300',
        badgeColor: 'bg-amber-600 text-white',
        dot: 'bg-amber-500',
        stageNum: 1,
        tempTarget: ambientTemp,
        ambientDelta: 'Thermal Excursion Risk (+22.5°C)',
      };
    } else {
      return {
        bay: 'Sliding Tray Linear Rails',
        sub: `Carriage traveling at 18 mm/s towards ${trayPosition > 50 ? 'Cold Chamber' : 'Ambient Bay'}`,
        status: 'IN_TRANSIT',
        color: 'text-blue-800 bg-blue-50/90 border-blue-300',
        badgeColor: 'bg-blue-600 text-white',
        dot: 'bg-blue-500',
        stageNum: 5,
        tempTarget: packageTemp,
        ambientDelta: `Moving (${Math.round(trayPosition)}% position)`,
      };
    }
  };

  const pkgLocation = getPackageLocationMeta();

  // Step navigation handlers
  const handlePrevStep = () => {
    const nextIdx = (currentStepIndex - 1 + HARDWARE_STEPS.length) % HARDWARE_STEPS.length;
    const target = HARDWARE_STEPS[nextIdx];
    onSelectStage(target.stageId);
    if (onStepChange) onStepChange(target.stepNum);
  };

  const handleNextStep = () => {
    const nextIdx = (currentStepIndex + 1) % HARDWARE_STEPS.length;
    const target = HARDWARE_STEPS[nextIdx];
    onSelectStage(target.stageId);
    if (onStepChange) onStepChange(target.stepNum);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* HEADER: TITLE + INTERACTIVE STEPPER / DEMO CONTROLLER         */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  Live Hardware Execution &amp; Package Pipeline
                </h2>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Step-by-Step AIoT Architecture
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Displays which hardware unit is currently running and where the package is physically positioned at every step
              </p>
            </div>
          </div>
        </div>

        {/* Live Step Navigation Pills & Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Step Controls: Prev / Next Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={handlePrevStep}
              className="p-1 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
              title="Previous Hardware Step"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Step Pills 1 to 6 */}
            <div className="flex items-center gap-1 px-1">
              {HARDWARE_STEPS.map((step) => {
                const isSelected =
                  activeStage === step.stageId ||
                  ((activeStage === 'SERVO' || activeStage === 'LIMIT_SWITCHES' || activeStage === 'SLIDING_TRAY') &&
                    step.stageId === 'SERVO');
                return (
                  <button
                    key={step.stepNum}
                    onClick={() => {
                      onSelectStage(step.stageId);
                      if (onStepChange) onStepChange(step.stepNum);
                    }}
                    className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs scale-105'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                    title={`Step ${step.stepNum}: ${step.hardwareName}`}
                  >
                    {step.shortName}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleNextStep}
              className="p-1 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
              title="Next Hardware Step"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Auto Walkthrough Loop Toggle */}
          {onToggleAutoWalkthrough && (
            <button
              onClick={onToggleAutoWalkthrough}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 shadow-2xs ${
                isAutoWalkthrough
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
              title={isAutoWalkthrough ? 'Auto Walkthrough Active (Cycling Steps)' : 'Manual Stepping Mode'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAutoWalkthrough ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{isAutoWalkthrough ? 'Auto Flow Active' : 'Manual Mode'}</span>
            </button>
          )}

          {/* Quick Simulation Actions */}
          {onTriggerExcursion && (
            <button
              onClick={onTriggerExcursion}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500 animate-pulse" />
              <span>Simulate Excursion</span>
            </button>
          )}

          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow-xs transition-colors active:scale-95 ${
                isPlaying ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-800'
              }`}
            >
              {isPlaying ? <Pause className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white" />}
              <span>{isPlaying ? 'Live Streaming' : 'Paused'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SPOTLIGHT BANNER: "WHERE IS THE PACKAGE?" + "WORKING HARDWARE" */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Banner 1: Package Physical Location Tracker */}
        <div className={`rounded-xl border p-4 shadow-xs flex items-center justify-between transition-all ${pkgLocation.color}`}>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white shadow-xs border border-current flex items-center justify-center shrink-0">
              <Box className="w-6 h-6 text-blue-600 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/95 px-2 py-0.5 rounded-full border border-current shadow-2xs">
                  📍 Where is the Package Right Now?
                </span>
                <span className={`w-2 h-2 rounded-full ${pkgLocation.dot} animate-ping`}></span>
              </div>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">
                {pkgLocation.bay}
              </div>
              <div className="text-xs text-slate-700 font-medium leading-relaxed">
                {currentStepInfo.hasPhysicalPackage
                  ? currentStepInfo.packageSub
                  : `${pkgLocation.sub} (Data being processed in Stage ${currentStepInfo.stepNum})`}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end text-right font-mono text-xs shrink-0 pl-2">
            <span className="text-slate-500 text-[10px] font-sans uppercase font-bold">Package Temp</span>
            <span className={`text-lg font-black ${packageTemp > 8.0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {packageTemp.toFixed(1)}°C
            </span>
            <span className="text-[10px] text-slate-600 font-sans">
              Carriage: <strong>{Math.round(trayPosition)}%</strong> ({Math.round(trayPosition * 3.4)} mm)
            </span>
          </div>
        </div>

        {/* Banner 2: Active Working Hardware Spotlight */}
        <div className="rounded-xl border border-blue-200 bg-linear-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white shadow-xs flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-2xs">
                  ⚡ Hardware State in this Step
                </span>
                <span className="text-[10px] font-mono text-emerald-700 font-extrabold bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300 animate-pulse">
                  ● WORKING NOW
                </span>
              </div>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">
                {currentStepInfo.hardwareName}
              </div>
              <div className="text-xs text-slate-700 font-medium">
                {currentStepInfo.hardwareStatus}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end text-right font-mono text-xs shrink-0 pl-2">
            <span className="text-slate-500 text-[10px] font-sans uppercase font-bold">Executing</span>
            <span className="text-base font-extrabold text-blue-700">
              STAGE {currentStepInfo.stepNum}/6
            </span>
            <span className="text-[10px] text-slate-500 font-sans">
              Protocol: <strong className="text-slate-800">{currentStepInfo.protocol.split(' ')[0]}</strong>
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
