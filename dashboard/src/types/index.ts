export interface LevelRole {
  id?: string;
  guildId: string;
  type: 'TEXT' | 'VOICE';
  level: number;
  roleId: string;
}

export interface PrestigeRole {
  id?: string;
  guildId: string;
  prestigeLevel: number;
  roleId: string;
}

export interface RoleIncome {
  id?: string;
  guildId: string;
  roleId: string;
  incomeAmount: number;
  intervalHours?: number;
  isSeasonal?: boolean;
}

export interface ShopRole {
  id?: string;
  guildId: string;
  roleId: string;
  price: number;
  description?: string;
  icon?: string;
}

export interface ShopItem {
  id?: string;
  guildId: string;
  name: string;
  price: number;
  description?: string;
  icon?: string;
  rarity?: string;
  isSeasonal?: boolean;
}

export interface ClanMember {
  id: string;
  clanId: string;
  userId: string;
  displayName: string;
  avatar: string;
  hoursSpent: number;
  allTimeHoursSpent?: number;
  periodHours?: number;
  joinedAt: string;
}

export interface ClanHistory {
  id: string;
  clanId: string;
  yearMonth: string;
  monthlyHours: number;
  topContributorUserId?: string | null;
  topContributorHours?: number;
  dailyBreakdownJson?: string;
}

export interface ClanData {
  id: string;
  guildId: string;
  name: string;
  leaderId: string;
  leaderName: string;
  voiceChannelId: string;
  roleId: string;
  colorHex: string;
  coins: number;
  totalHours: number;
  totalAllTimeHours?: number;
  currentMonthHours?: number;
  membersCount: number;
  immunityShields?: number;
  hasMediaPerms?: boolean;
  hasSoundboardPerms?: boolean;
  isHiddenClan?: boolean;
  members: ClanMember[];
  monthlyHistory?: ClanHistory[];
}

export interface ClanShopItem {
  id: string;
  guildId: string;
  name: string;
  price: number;
  description: string;
  icon: string;
  itemType: 'PERMANENT_PERK' | 'CONSUMABLE' | 'CUSTOM_ITEM';
  actionKey?: string | null;
  isAvailable: boolean;
}

export interface GuildConfig {
  guildId: string;
  levelingEnabled?: boolean;
  tempvcEnabled?: boolean;
  tempVcEnabled?: boolean;
  clansEnabled?: boolean;
  tempvcCategoryId?: string | null;
  tempvcChannelId?: string | null;
  minXpPerMessage?: number;
  maxXpPerMessage?: number;
  xpCooldownSeconds?: number;
  xpPerMinuteVc?: number;
  levelUpChannelId?: string | null;
  levelUpMessage?: string;
  ignoredChannels?: string;
  ignoredRoles?: string;
  adminRoleIds?: string;
  charleteroRoleId?: string | null;
  charlatanRoleId?: string | null;
  commandsChannelId?: string | null;
  verifiedRoleId?: string | null;
  birthdayRoleId?: string | null;
  birthdayChannelId?: string | null;
  birthdayMessage?: string;
  birthdayEnabled?: boolean;
  currencySymbol?: string;
  economyEnabled?: boolean;
  workMinPayout?: number;
  workMaxPayout?: number;
  workCooldownSec?: number;
  crimeMinPayout?: number;
  crimeMaxPayout?: number;
  crimeSuccessPercent?: number;
  crimeCooldownSec?: number;
  slutMinPayout?: number;
  slutMaxPayout?: number;
  slutSuccessPercent?: number;
  slutCooldownSec?: number;
  robCooldownSec?: number;
  robMinPercent?: number;
  robMaxPercent?: number;
  chickenCost?: number;
  piensoCost?: number;
  piensoDurationMins?: number;
  piensoBoostPercent?: number;
  medkitCost?: number;
  bandageCost?: number;
  vitaminCost?: number;
  vitaminBoostPercent?: number;
  cageCost?: number;
  cageCapacityLvl2Cost?: number;
  cageCapacityLvl3Cost?: number;
  cageMuscleLvl1Cost?: number;
  cageMuscleLvl2Cost?: number;
  cageMuscleLvl3Cost?: number;
  cageCardioLvl1Cost?: number;
  cageCardioLvl2Cost?: number;
  cageCardioLvl3Cost?: number;
  cagePhysioLvl1Cost?: number;
  cagePhysioLvl2Cost?: number;
  cagePhysioLvl3Cost?: number;
  chickenMinBirthWinRate?: number;
  chickenMaxBirthWinRate?: number;
  chickenInjuryMins?: number;
  chickenInjuryChance?: number;
  chickenNames?: string;
  incomeIntervalHours?: number;
  casinoChannels?: string;
  workMessages?: string;
  crimeMessages?: string;
  crimeFailMessages?: string;
  slutMessages?: string;
  slutFailMessages?: string;
  casinoLogChannelId?: string | null;
  slotMachineDifficulty?: string;
  startingBalance?: number;
  seasonWinnerRoleId?: string | null;
  clansCategoryId?: string | null;
  clanLeaderRoleId?: string | null;
  monthlyClanHoursGoal?: number;
  clanGoalMode?: 'FIXED' | 'PER_MEMBER';
  clanHoursPerMember?: number;
  clanCoinsPerHour?: number;
  clanCurrencyName?: string;
  clanShopTicketMessage?: string;
  clansLogChannelId?: string | null;
  levelRoles?: LevelRole[];
  prestigeRoles?: PrestigeRole[];
  roleIncomes?: RoleIncome[];
  shopRoles?: ShopRole[];
  shopItems?: ShopItem[];
}

export interface Guild {
  id: string;
  name: string;
  icon: string;
  memberCount: number;
}

export interface UserXP {
  id: string;
  userId: string;
  textXp: number;
  textLevel: number;
  prestige?: number;
  voiceXp: number;
  voiceLevel: number;
  messageCount: number;
  vcSeconds: number;
  displayName: string;
  avatar: string;
}

export interface ServerStats {
  memberCount: number;
  activeTempChannels: number;
  registeredUsersCount: number;
  name: string;
}

export interface ServerStructure {
  textChannels: { id: string; name: string }[];
  voiceChannels: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  roles: { id: string; name: string; color: string }[];
}

export interface CustomTrigger {
  id: string;
  guildId: string;
  trigger: string;
  response: string;
  responseType: string; // 'TEXT' or 'EMBED'
  requiredRoleId?: string | null;
  targetChannelId?: string | null;
  cooldown: number;
  createdAt?: string;
  updatedAt?: string;
}

export type Tab = 'dashboard' | 'general' | 'leveling' | 'tempvc' | 'clans' | 'casino' | 'leaderboard' | 'birthdays' | 'triggers';
export type CasinoSubTab = 'general' | 'work' | 'crime' | 'slut' | 'rob' | 'chicken' | 'shop' | 'income' | 'reset';
