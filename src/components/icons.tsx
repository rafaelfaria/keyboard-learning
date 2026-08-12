import type { CSSProperties } from 'react';
import {
  House, Map, Keyboard, Gamepad2, Rocket, TrendingUp, CalendarDays, Medal, School,
  CircleUser, Settings, Menu, Zap, Target, Brain, Flower2, Dumbbell, Waves, Footprints,
  ClipboardList, Braces, Calculator, Headphones, FileText, EyeOff, LifeBuoy, Shield,
  Hammer, Wind, Puzzle, Blocks, Swords, Trophy, Tent, Wheat, Mountain, TreePine,
  Landmark, MountainSnow, Anchor, Route, Flame, Sparkles, Sun, CloudSun, Cloud,
  CloudRain, CloudDrizzle, CloudFog, Ghost, Ticket, Bot, Users, Moon, Apple, Flag,
  Minus, Eye, BookOpen, Briefcase, PartyPopper, Gem, Microscope, Leaf, Feather, Bird,
  Tornado, Music, Drum, Hourglass, Milestone, KeyRound, Compass, CalendarCheck,
  Stethoscope, Crosshair, Gauge, Backpack, Crown, Bell, Lamp, Shell, Star, Play,
  Lock, GraduationCap, Sprout, SlidersHorizontal, Turtle, Rabbit, Lightbulb, Info,
  Palette, Accessibility, Database, Volume2, Timer, Heart, Send, Sailboat, Bug,
  CircleCheck, TriangleAlert, Wrench, Glasses, Notebook, MessageCircle, Smile,
  Snowflake, Umbrella, Bike, Camera, Gift, Key, Magnet, Origami, Pyramid, Rainbow,
  Save, Ship, Stamp, Sword, Telescope, Watch, Axe, Banana, Cat, Dog, Fish, Squirrel,
  Signpost, ZoomIn, Type, Ear, PersonStanding, Snail, Dices, Castle, Candy, Pause, CircleHelp,
  LogOut, UserPlus, ChevronRight, Check,
  type LucideIcon,
} from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  house: House, map: Map, keyboard: Keyboard, gamepad: Gamepad2, rocket: Rocket,
  trending: TrendingUp, calendar: CalendarDays, medal: Medal, school: School,
  user: CircleUser, settings: Settings, menu: Menu, zap: Zap, target: Target,
  brain: Brain, flower: Flower2, dumbbell: Dumbbell, waves: Waves, footprints: Footprints,
  clipboard: ClipboardList, braces: Braces, calculator: Calculator, headphones: Headphones,
  file: FileText, 'eye-off': EyeOff, lifebuoy: LifeBuoy, shield: Shield, hammer: Hammer,
  wind: Wind, puzzle: Puzzle, blocks: Blocks, swords: Swords, trophy: Trophy,
  tent: Tent, wheat: Wheat, mountain: Mountain, tree: TreePine, landmark: Landmark,
  peaks: MountainSnow, anchor: Anchor, route: Route, flame: Flame, sparkles: Sparkles,
  sun: Sun, 'cloud-sun': CloudSun, cloud: Cloud, 'cloud-rain': CloudRain,
  'cloud-drizzle': CloudDrizzle, 'cloud-fog': CloudFog, ghost: Ghost, ticket: Ticket,
  bot: Bot, users: Users, moon: Moon, apple: Apple, flag: Flag, minus: Minus,
  eye: Eye, book: BookOpen, briefcase: Briefcase, party: PartyPopper, gem: Gem,
  microscope: Microscope, leaf: Leaf, feather: Feather, bird: Bird, tornado: Tornado,
  music: Music, drum: Drum, hourglass: Hourglass, milestone: Milestone, key: KeyRound,
  compass: Compass, 'calendar-check': CalendarCheck, stethoscope: Stethoscope,
  crosshair: Crosshair, gauge: Gauge, backpack: Backpack, crown: Crown, bell: Bell,
  lamp: Lamp, shell: Shell, star: Star, play: Play, lock: Lock, grad: GraduationCap,
  sprout: Sprout, sliders: SlidersHorizontal, turtle: Turtle, rabbit: Rabbit,
  bulb: Lightbulb, info: Info, palette: Palette, access: Accessibility, database: Database,
  volume: Volume2, timer: Timer, heart: Heart, send: Send, sailboat: Sailboat, bug: Bug,
  check: CircleCheck, warn: TriangleAlert, wrench: Wrench, glasses: Glasses,
  notebook: Notebook, chat: MessageCircle, smile: Smile, snowflake: Snowflake,
  umbrella: Umbrella, bike: Bike, camera: Camera, gift: Gift, 'key-classic': Key,
  magnet: Magnet, origami: Origami, pyramid: Pyramid, rainbow: Rainbow, save: Save,
  ship: Ship, stamp: Stamp, sword: Sword, telescope: Telescope, watch: Watch,
  axe: Axe, banana: Banana, cat: Cat, dog: Dog, fish: Fish, squirrel: Squirrel,
  signpost: Signpost, zoom: ZoomIn, type: Type, ear: Ear, person: PersonStanding,
  snail: Snail, dice: Dices, castle: Castle, candy: Candy, pause: Pause, help: CircleHelp,
  logout: LogOut, 'user-plus': UserPlus, 'chevron-right': ChevronRight, tick: Check,
};

/** Icon by kebab name; falls back to rendering the string itself (legacy emoji data). */
export function Ic({ n, size = 18, className = '', strokeWidth = 2.1, style }: {
  n: string; size?: number; className?: string; strokeWidth?: number; style?: CSSProperties;
}) {
  const Cmp = ICONS[n];
  if (!Cmp) return <span className={className} style={{ fontSize: size * 0.9, lineHeight: 1, ...style }} aria-hidden>{n}</span>;
  return <Cmp size={size} strokeWidth={strokeWidth} className={`ic ${className}`} style={style} aria-hidden />;
}
