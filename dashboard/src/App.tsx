import React, { useState, useEffect } from 'react';
import './App.css';
import type {
  Tab,
  CasinoSubTab,
  GuildConfig,
  ServerStats,
  UserXP,
  ServerStructure,
  Guild,
  ClanData,
  ClanShopItem,
  LevelRole,
  PrestigeRole,
  ShopRole,
  ShopItem,
  RoleIncome
} from './types';

// Layout & UI Components
import { Sidebar } from './components/Sidebar';
import { PageHeader } from './components/PageHeader';
import { Toast } from './components/Toast';

// Modales
import { CreateClanModal } from './components/modals/CreateClanModal';
import { ImportClanModal } from './components/modals/ImportClanModal';

// Páginas del Módulo
import { DashboardOverview } from './pages/DashboardOverview';
import { GeneralSettings } from './pages/GeneralSettings';
import { LevelingSettings } from './pages/LevelingSettings';
import { TempVCSettings } from './pages/TempVCSettings';
import { BirthdaysSettings } from './pages/BirthdaysSettings';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ClansPage } from './pages/ClansPage';
import { CasinoPage } from './pages/CasinoPage';
import { CustomTriggersSettings } from './pages/CustomTriggersSettings';

const rawApiBase = import.meta.env.VITE_API_URL || '';
const API_BASE = rawApiBase ? rawApiBase.replace(/\/$/, '') : '';

// Mocks por defecto para modo offline/demo
const MOCK_STATS: ServerStats = {
  memberCount: 1250,
  activeTempChannels: 3,
  registeredUsersCount: 312,
  name: 'Retrasíados',
};

const MOCK_CONFIG: GuildConfig = {
  guildId: '123456789012345678',
  levelingEnabled: true,
  tempvcEnabled: true,
  tempvcCategoryId: '',
  tempvcChannelId: '',
  minXpPerMessage: 15,
  maxXpPerMessage: 25,
  xpCooldownSeconds: 60,
  xpPerMinuteVc: 10,
  levelUpChannelId: '',
  levelUpMessage: ' {user} ha subido al nivel {level} ({type})!',
  ignoredChannels: '',
  ignoredRoles: '',
  adminRoleIds: '',
  birthdayRoleId: '',
  birthdayChannelId: '',
  birthdayMessage: ' Feliz cumpleaños {user}! Que pases un gran día.',
  birthdayEnabled: true,
  levelRoles: [
    { guildId: '123456789012345678', type: 'TEXT', level: 5, roleId: '1029384756' },
    { guildId: '123456789012345678', type: 'VOICE', level: 3, roleId: '9876543210' },
  ],
};

const MOCK_LB: UserXP[] = [
  { id: '1', userId: '1', textXp: 8400, textLevel: 14, voiceXp: 4200, voiceLevel: 5,  messageCount: 890, vcSeconds: 15000, displayName: 'Zarpik',      avatar: 'https://cdn.discordapp.com/embed/avatars/4.png' },
  { id: '2', userId: '2', textXp: 6100, textLevel: 12, voiceXp: 980,  voiceLevel: 2,  messageCount: 710, vcSeconds: 12200, displayName: 'Kratos',      avatar: 'https://cdn.discordapp.com/embed/avatars/3.png' },
  { id: '3', userId: '3', textXp: 4300, textLevel: 9,  voiceXp: 9100, voiceLevel: 10, messageCount: 420, vcSeconds: 8400,  displayName: 'Sofia_Dev',   avatar: 'https://cdn.discordapp.com/embed/avatars/0.png' },
  { id: '4', userId: '4', textXp: 2900, textLevel: 7,  voiceXp: 1500, voiceLevel: 3,  messageCount: 230, vcSeconds: 4300,  displayName: 'AlexG',       avatar: 'https://cdn.discordapp.com/embed/avatars/5.png' },
  { id: '5', userId: '5', textXp: 1100, textLevel: 5,  voiceXp: 0,    voiceLevel: 0,  messageCount: 190, vcSeconds: 3100,  displayName: 'LunarClient', avatar: 'https://cdn.discordapp.com/embed/avatars/1.png' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [casinoSubTab, setCasinoSubTab] = useState<CasinoSubTab>('general');
  const [isOnline, setIsOnline] = useState(false);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [config, setConfig] = useState<GuildConfig>({ ...MOCK_CONFIG });
  const [stats, setStats] = useState<ServerStats>({ ...MOCK_STATS });
  const [lb, setLb] = useState<UserXP[]>([]);
  const [structure, setStructure] = useState<ServerStructure>({ textChannels: [], voiceChannels: [], categories: [], roles: [] });
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Authentication State
  const [authUser, setAuthUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Casino sub-tab & forms state
  const [shopCategory, setShopCategory] = useState<'roles' | 'items'>('roles');
  const [newShopRoleId, setNewShopRoleId] = useState('');
  const [newShopPrice, setNewShopPrice] = useState(50000);
  const [newShopIcon, setNewShopIcon] = useState('👑');
  const [newShopDescription, setNewShopDescription] = useState('');

  const [newShopItemName, setNewShopItemName] = useState('');
  const [newShopItemPrice, setNewShopItemPrice] = useState(10000);
  const [newShopItemRarity, setNewShopItemRarity] = useState('Común');
  const [newShopItemIcon, setNewShopItemIcon] = useState('🎁');
  const [newShopItemDesc, setNewShopItemDesc] = useState('');

  const [newIncomeRoleId, setNewIncomeRoleId] = useState('');
  const [newIncomeAmount, setNewIncomeAmount] = useState(10000);
  const [newIncomeHours, setNewIncomeHours] = useState(3);
  const [newIncomeIsSeasonal, setNewIncomeIsSeasonal] = useState(true);

  // Clanes
  const [clans, setClans] = useState<ClanData[]>([]);
  const [clanModalOpen, setClanModalOpen] = useState(false);
  const [importClanModalOpen, setImportClanModalOpen] = useState(false);
  const [newClanName, setNewClanName] = useState('');
  const [newClanRoleName, setNewClanRoleName] = useState('');
  const [newClanColor, setNewClanColor] = useState('#5865F2');
  const [newClanLeaderId, setNewClanLeaderId] = useState('');
  const [importVoiceChannelId, setImportVoiceChannelId] = useState('');
  const [importRoleId, setImportRoleId] = useState('');
  const [expandedClanId, setExpandedClanId] = useState<string | null>(null);
  const [activeClanDetailId, setActiveClanDetailId] = useState<string | null>(null);
  const [selectedMonthPeriod, setSelectedMonthPeriod] = useState<string>('');
  const [memberFilterQuery, setMemberFilterQuery] = useState('');
  const [clanSubTab, setClanSubTab] = useState<'list' | 'shop' | 'settings'>('list');
  const [dbShopItems, setDbShopItems] = useState<ClanShopItem[]>([]);
  const [editingShopItemPrices, setEditingShopItemPrices] = useState<Record<string, number>>({});
  const [newClanShopName, setNewClanShopName] = useState('');
  const [newClanShopPrice, setNewClanShopPrice] = useState(10);
  const [newClanShopDesc, setNewClanShopDesc] = useState('');
  const [newClanShopIcon, setNewClanShopIcon] = useState('✨');

  // Búsqueda ágil de líder de clan
  const [leaderSearchQuery, setLeaderSearchQuery] = useState('');
  const [leaderSearchResults, setLeaderSearchResults] = useState<{ id: string; username: string; displayName: string; avatar: string }[]>([]);
  const [isSearchingLeader, setIsSearchingLeader] = useState(false);
  const [selectedLeaderUser, setSelectedLeaderUser] = useState<{ id: string; displayName: string; avatar: string } | null>(null);

  // Economía Ranking & Prestigio
  const [economyLb, setEconomyLb] = useState<{ userId: string; cash: number; bank: number; total: number; displayName?: string; avatar?: string }[]>([]);
  const [seasonalEdits, setSeasonalEdits] = useState<Record<string, { name: string; color: string; icon?: string; price?: number; description?: string; incomeAmount?: number }>>({});
  const [resetConfirmed, setResetConfirmed] = useState(false);

  // Leveling roles state
  const [newRoleType, setNewRoleType] = useState<'TEXT' | 'VOICE'>('TEXT');
  const [newRoleLevel, setNewRoleLevel] = useState(1);
  const [newRoleId, setNewRoleId] = useState('');

  // Prestige roles state
  const [newPrestigeLevel, setNewPrestigeLevel] = useState(1);
  const [newPrestigeRoleId, setNewPrestigeRoleId] = useState('');

  // Auxiliares CSV
  const getCsvArray = (csvString?: string | null): string[] => {
    if (!csvString) return [];
    return csvString.split(',').map(s => s.trim()).filter(Boolean);
  };

  const addCsvItem = (csvString: string | null | undefined, newId: string): string => {
    const arr = getCsvArray(csvString);
    if (!arr.includes(newId)) arr.push(newId);
    return arr.join(',');
  };

  const removeCsvItem = (csvString: string | null | undefined, targetId: string): string => {
    const arr = getCsvArray(csvString).filter(id => id !== targetId);
    return arr.join(',');
  };

  // Toast Trigger
  const triggerToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  // Helper para authFetch (añade cabecera de autenticación si existe token)
  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    const headers = {
      ...(options.headers || {}),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 && token) {
      setAuthUser(null);
      localStorage.removeItem('auth_token');
    }
    return res;
  };

  // Manejar Login / Logout / Callback OAuth2
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error === 'no_admin_guilds') {
      setAuthError('No se encontraron servidores donde tengas permisos de Administrador.');
    }

    // Si recibimos el código de Discord OAuth2
    if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
      fetch(`${API_BASE}/api/auth/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state })
      })
        .then(res => res.json())
        .then(data => {
          if (data.token) {
            localStorage.setItem('auth_token', data.token);
            setAuthUser(data.user);
          } else if (data.error) {
            setAuthError(data.error);
          }
        })
        .catch(err => console.error('Error en OAuth callback:', err));
      return;
    }

    const checkAuth = async () => {
      const storedToken = localStorage.getItem('auth_token');
      if (!storedToken) return;

      try {
        const res = await authFetch(`${API_BASE}/api/auth/me`);
        if (res.ok) {
          const userData = await res.json();
          setAuthUser(userData.user || userData);
        } else {
          localStorage.removeItem('auth_token');
        }
      } catch (err) {
        console.error('Error verificando sesión auth:', err);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login-url`);
      const data = await res.json();
      if (data.loginUrl) {
        window.location.href = data.loginUrl;
      } else {
        alert('No se pudo obtener la URL de autenticación de Discord.');
      }
    } catch {
      alert('Error al conectar con el servidor para iniciar sesión.');
    }
  };

  const handleLogout = async () => {
    try {
      await authFetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
    } catch {}
    localStorage.removeItem('auth_token');
    setAuthUser(null);
    window.location.reload();
  };

  // Búsqueda ágil de usuarios para líder de clan con debounce
  useEffect(() => {
    if (!selectedGuild || !leaderSearchQuery.trim() || selectedLeaderUser) {
      setLeaderSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingLeader(true);
      try {
        const res = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/members/search?q=${encodeURIComponent(leaderSearchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setLeaderSearchResults(data);
        }
      } catch (e) {
        console.error('Error buscando miembro para líder:', e);
      } finally {
        setIsSearchingLeader(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [leaderSearchQuery, selectedGuild, selectedLeaderUser]);

  // Carga inicial de servidores
  useEffect(() => {
    const fetchGuilds = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/guilds`);
        if (!res.ok) throw new Error('API offline');
        const data: Guild[] = await res.json();
        setIsOnline(true);
        setGuilds(data);
        if (data.length > 0) {
          setSelectedGuild(data[0].id);
        }
      } catch {
        setIsOnline(false);
        setGuilds([{ id: MOCK_CONFIG.guildId, name: MOCK_STATS.name, icon: '', memberCount: MOCK_STATS.memberCount }]);
        setSelectedGuild(MOCK_CONFIG.guildId);
        setLb(MOCK_LB);
      }
    };
    fetchGuilds();
  }, [authUser]);

  // Carga de datos de un servidor seleccionado
  const fetchGuildData = async (gId: string) => {
    if (!gId) return;
    try {
      const [cfgRes, stRes, lbRes, structRes, econRes, clansRes, shopRes] = await Promise.all([
        authFetch(`${API_BASE}/api/guilds/${gId}/config`),
        authFetch(`${API_BASE}/api/guilds/${gId}/stats`),
        authFetch(`${API_BASE}/api/guilds/${gId}/leaderboard`),
        authFetch(`${API_BASE}/api/guilds/${gId}/structure`),
        authFetch(`${API_BASE}/api/guilds/${gId}/economy/leaderboard`),
        authFetch(`${API_BASE}/api/guilds/${gId}/clans`),
        authFetch(`${API_BASE}/api/guilds/${gId}/clans/shop`),
      ]);

      if (cfgRes.ok) setConfig(await cfgRes.json());
      if (stRes.ok) setStats(await stRes.json());
      if (lbRes.ok) setLb(await lbRes.json());
      if (structRes.ok) setStructure(await structRes.json());
      if (econRes.ok) setEconomyLb(await econRes.json());
      if (clansRes.ok) setClans(await clansRes.json());
      if (shopRes.ok) {
        const items: ClanShopItem[] = await shopRes.json();
        setDbShopItems(items);
        const priceMap: Record<string, number> = {};
        items.forEach(it => { priceMap[it.id] = it.price; });
        setEditingShopItemPrices(priceMap);
      }
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    }
  };

  const fetchClans = async () => {
    if (!selectedGuild) return;
    try {
      const res = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/clans`);
      if (res.ok) setClans(await res.json());
      const shopRes = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/clans/shop`);
      if (shopRes.ok) {
        const items: ClanShopItem[] = await shopRes.json();
        setDbShopItems(items);
      }
    } catch {}
  };

  useEffect(() => {
    if (selectedGuild) {
      fetchGuildData(selectedGuild);
    }
  }, [selectedGuild]);

  // Guardar Configuración de un servidor
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuild) return;
    try {
      const res = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        triggerToast('¡Configuración guardada en la base de datos!');
      } else {
        triggerToast('Error al guardar en el servidor');
      }
    } catch {
      triggerToast('Modo offline: Cambios aplicados localmente');
    }
  };

  // Creación de clan
  const handleCreateClanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClanName || !newClanLeaderId || !selectedGuild) return;
    try {
      const res = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/clans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClanName,
          roleName: newClanRoleName || undefined,
          colorHex: newClanColor,
          leaderId: newClanLeaderId,
        }),
      });

      if (res.ok) {
        triggerToast(`🛡️ Clan "${newClanName}" creado con éxito en Discord`);
        setClanModalOpen(false);
        setNewClanName('');
        setNewClanRoleName('');
        setNewClanLeaderId('');
        setSelectedLeaderUser(null);
        fetchClans();
      } else {
        const err = await res.json();
        alert(`Error al crear el clan: ${err.error || 'Error desconocido'}`);
      }
    } catch (e) {
      alert('Error al conectar con la API de clanes');
    }
  };

  // Importar clan pre-existente
  const handleImportClanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClanName || !importVoiceChannelId || !importRoleId || !newClanLeaderId || !selectedGuild) return;
    try {
      const res = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/clans/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClanName,
          voiceChannelId: importVoiceChannelId,
          roleId: importRoleId,
          leaderId: newClanLeaderId,
          colorHex: newClanColor,
        }),
      });

      if (res.ok) {
        triggerToast(` Clan "${newClanName}" vinculado con éxito`);
        setImportClanModalOpen(false);
        setNewClanName('');
        setImportVoiceChannelId('');
        setImportRoleId('');
        setNewClanLeaderId('');
        setSelectedLeaderUser(null);
        fetchClans();
      } else {
        const err = await res.json();
        alert(`Error al importar clan: ${err.error || 'Error desconocido'}`);
      }
    } catch (e) {
      alert('Error al conectar con la API para importar clan');
    }
  };

  // Borrado de Clan
  const handleDeleteClan = async (clanId: string, clanName: string) => {
    if (!confirm(`⚠️ ¿Estás seguro de eliminar el clan "${clanName}"? Esto eliminará su canal de voz, su rol de Discord y sus registros de la BD.`)) return;
    try {
      const res = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/clans/${clanId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        triggerToast(`Clan "${clanName}" eliminado correctamente`);
        fetchClans();
      }
    } catch {
      alert('Error al eliminar clan');
    }
  };

  // Roles por Nivel
  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleId || !selectedGuild) return;
    const newRole: LevelRole = { guildId: selectedGuild, type: newRoleType, level: newRoleLevel, roleId: newRoleId };
    try {
      const res = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/level-roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRole),
      });
      if (res.ok) {
        triggerToast('Rol por nivel añadido');
        setConfig(c => ({ ...c, levelRoles: [...(c.levelRoles || []), newRole] }));
        setNewRoleId('');
      }
    } catch {
      setConfig(c => ({ ...c, levelRoles: [...(c.levelRoles || []), newRole] }));
      triggerToast('Rol por nivel añadido (demo)');
      setNewRoleId('');
    }
  };

  const handleDeleteRole = async (roleId?: string, type?: 'TEXT' | 'VOICE', level?: number) => {
    if (!selectedGuild) return;
    try {
      await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/level-roles`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, level, roleId }),
      });
    } catch {}
    setConfig(c => ({
      ...c,
      levelRoles: (c.levelRoles || []).filter(r => !(r.type === type && r.level === level && r.roleId === roleId)),
    }));
    triggerToast('Rol por nivel eliminado');
  };

  // Roles de Prestigio
  const handleAddPrestigeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrestigeRoleId || !selectedGuild) return;
    const newRole: PrestigeRole = { guildId: selectedGuild, prestigeLevel: newPrestigeLevel, roleId: newPrestigeRoleId };
    try {
      const res = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/prestige-roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRole),
      });
      if (res.ok) {
        const created = await res.json();
        triggerToast('Rol de prestigio añadido');
        setConfig(c => ({ ...c, prestigeRoles: [...(c.prestigeRoles || []), created] }));
        setNewPrestigeRoleId('');
      }
    } catch {
      setConfig(c => ({ ...c, prestigeRoles: [...(c.prestigeRoles || []), newRole] }));
      triggerToast('Rol de prestigio añadido (demo)');
      setNewPrestigeRoleId('');
    }
  };

  const handleDeletePrestigeRole = async (id?: string) => {
    if (!selectedGuild || !id) return;
    try {
      await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/prestige-roles/${id}`, {
        method: 'DELETE',
      });
    } catch {}
    setConfig(c => ({
      ...c,
      prestigeRoles: (c.prestigeRoles || []).filter(r => r.id !== id),
    }));
    triggerToast('Rol de prestigio eliminado');
  };

  // Tienda del Casino & Ingresos por Roles
  const handleAddShopRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopRoleId || !selectedGuild) return;
    const item: ShopRole = { guildId: selectedGuild, roleId: newShopRoleId, price: newShopPrice, icon: newShopIcon, description: newShopDescription };
    try {
      const res = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/economy/shop-roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        const created = await res.json();
        setConfig(c => ({ ...c, shopRoles: [...(c.shopRoles || []), created] }));
        triggerToast('Rol de tienda añadido');
        setNewShopRoleId('');
        setNewShopDescription('');
      }
    } catch {
      setConfig(c => ({ ...c, shopRoles: [...(c.shopRoles || []), item] }));
      triggerToast('Rol de tienda añadido (demo)');
    }
  };

  const handleDeleteShopRole = async (id?: string) => {
    if (!selectedGuild || !id) return;
    try {
      await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/economy/shop-roles/${id}`, { method: 'DELETE' });
    } catch {}
    setConfig(c => ({ ...c, shopRoles: (c.shopRoles || []).filter(s => s.id !== id) }));
    triggerToast('Rol de tienda eliminado');
  };

  const handleAddShopItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopItemName || !selectedGuild) return;
    const item: ShopItem = {
      guildId: selectedGuild,
      name: newShopItemName,
      price: newShopItemPrice,
      rarity: newShopItemRarity,
      icon: newShopItemIcon,
      description: newShopItemDesc
    };
    try {
      const res = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/economy/shop-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        const created = await res.json();
        setConfig(c => ({ ...c, shopItems: [...(c.shopItems || []), created] }));
        triggerToast('Objeto coleccionable añadido');
        setNewShopItemName('');
        setNewShopItemDesc('');
      }
    } catch {
      setConfig(c => ({ ...c, shopItems: [...(c.shopItems || []), item] }));
      triggerToast('Objeto coleccionable añadido (demo)');
    }
  };

  const handleDeleteShopItem = async (id?: string) => {
    if (!selectedGuild || !id) return;
    try {
      await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/economy/shop-items/${id}`, { method: 'DELETE' });
    } catch {}
    setConfig(c => ({ ...c, shopItems: (c.shopItems || []).filter(s => s.id !== id) }));
    triggerToast('Objeto coleccionable retirado');
  };

  const handleAddRoleIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncomeRoleId || !selectedGuild) return;
    const item: RoleIncome = {
      guildId: selectedGuild,
      roleId: newIncomeRoleId,
      incomeAmount: newIncomeAmount,
      intervalHours: newIncomeHours,
      isSeasonal: newIncomeIsSeasonal
    };
    try {
      const res = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/economy/role-incomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        const created = await res.json();
        setConfig(c => ({ ...c, roleIncomes: [...(c.roleIncomes || []), created] }));
        triggerToast('Sueldo de rol añadido');
        setNewIncomeRoleId('');
      }
    } catch {
      setConfig(c => ({ ...c, roleIncomes: [...(c.roleIncomes || []), item] }));
      triggerToast('Sueldo de rol añadido (demo)');
    }
  };

  const handleDeleteRoleIncome = async (id?: string) => {
    if (!selectedGuild || !id) return;
    try {
      await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/economy/role-incomes/${id}`, { method: 'DELETE' });
    } catch {}
    setConfig(c => ({ ...c, roleIncomes: (c.roleIncomes || []).filter(s => s.id !== id) }));
    triggerToast('Sueldo de rol eliminado');
  };

  const handleSeasonReset = async () => {
    if (!resetConfirmed || !selectedGuild) return;
    try {
      const res = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/economy/reset-season`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleEdits: seasonalEdits
        })
      });
      if (res.ok) {
        const data = await res.json();
        triggerToast(`🎉 ¡Nueva Temporada iniciada! ${data.winnerId ? 'Se ha otorgado el rol de ganador al top 1.' : ''}`);
        setResetConfirmed(false);
        fetchGuildData(selectedGuild);
      } else {
        alert('Error al procesar el reinicio de temporada.');
      }
    } catch {
      triggerToast('Reinicio procesado (Modo Demo)');
    }
  };

  const fmtTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const currentGuild = guilds.find(g => g.id === selectedGuild);
  const unlinkedChannels = structure.voiceChannels.filter(vc => !clans.some(c => c.voiceChannelId === vc.id));

  // Render Pantalla de Inicio de Sesión si no está autenticado
  if (!authUser) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#090a0c',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        padding: 20
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: 40,
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px 0', color: '#fff' }}>RetraBot Dashboard</h1>
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            Inicia sesión con tu cuenta de Discord para acceder al panel de administración de tus servidores.
          </p>

          {authError && (
            <div style={{
              background: 'rgba(231, 76, 60, 0.15)',
              border: '1px solid #e74c3c',
              color: '#e74c3c',
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 20
            }}>
              {authError}
            </div>
          )}

          <button
            onClick={handleLogin}
            style={{
              background: '#5865F2',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(88, 101, 242, 0.4)',
              transition: 'background 0.2s'
            }}
          >
             Iniciar Sesión con Discord
          </button>
        </div>
      </div>
    );
  }

  // APP LAYOUT PRINCIPAL
  return (
    <div className="app">
      {/* Toast Flotante */}
      <Toast toast={toast} toastVisible={toastVisible} />

      {/* Menú Lateral (Sidebar) */}
      <Sidebar
        tab={tab}
        setTab={setTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        currentGuild={currentGuild}
        stats={stats}
        isOnline={isOnline}
      />

      {/* Contenido Principal */}
      <div className="main">
        {/* Cabecera Superior */}
        <PageHeader
          tab={tab}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          stats={stats}
          lbLength={lb.length}
          authUser={authUser}
          handleLogout={handleLogout}
        />

        {/* Módulos / Rutas */}
        {tab === 'dashboard' && (
          <DashboardOverview
            stats={stats}
            config={config}
            clans={clans}
            lb={lb}
            economyLb={economyLb}
            setTab={setTab}
          />
        )}

        {tab === 'general' && (
          <GeneralSettings
            config={config}
            setConfig={setConfig}
            structure={structure}
            handleSave={handleSave}
            getCsvArray={getCsvArray}
            addCsvItem={addCsvItem}
            removeCsvItem={removeCsvItem}
          />
        )}

        {tab === 'leveling' && (
          <LevelingSettings
            config={config}
            setConfig={setConfig}
            structure={structure}
            handleSave={handleSave}
            getCsvArray={getCsvArray}
            addCsvItem={addCsvItem}
            removeCsvItem={removeCsvItem}
            handleAddRole={handleAddRole}
            handleDeleteRole={handleDeleteRole}
            handleAddPrestigeRole={handleAddPrestigeRole}
            handleDeletePrestigeRole={handleDeletePrestigeRole}
            newRoleType={newRoleType}
            setNewRoleType={setNewRoleType}
            newRoleLevel={newRoleLevel}
            setNewRoleLevel={setNewRoleLevel}
            newRoleId={newRoleId}
            setNewRoleId={setNewRoleId}
            newPrestigeLevel={newPrestigeLevel}
            setNewPrestigeLevel={setNewPrestigeLevel}
            newPrestigeRoleId={newPrestigeRoleId}
            setNewPrestigeRoleId={setNewPrestigeRoleId}
          />
        )}

        {tab === 'tempvc' && (
          <TempVCSettings
            config={config}
            setConfig={setConfig}
            structure={structure}
            stats={stats}
            handleSave={handleSave}
          />
        )}

        {tab === 'birthdays' && (
          <BirthdaysSettings
            config={config}
            setConfig={setConfig}
            structure={structure}
            handleSave={handleSave}
            setTab={setTab}
          />
        )}

        {tab === 'leaderboard' && (
          <LeaderboardPage
            lb={lb}
            fmtTime={fmtTime}
          />
        )}

        {tab === 'clans' && (
          <ClansPage
            clans={clans}
            config={config}
            setConfig={setConfig}
            structure={structure}
            activeClanDetailId={activeClanDetailId}
            setActiveClanDetailId={setActiveClanDetailId}
            selectedMonthPeriod={selectedMonthPeriod}
            setSelectedMonthPeriod={setSelectedMonthPeriod}
            memberFilterQuery={memberFilterQuery}
            setMemberFilterQuery={setMemberFilterQuery}
            clanSubTab={clanSubTab}
            setClanSubTab={setClanSubTab}
            dbShopItems={dbShopItems}
            editingShopItemPrices={editingShopItemPrices}
            setEditingShopItemPrices={setEditingShopItemPrices}
            newClanShopName={newClanShopName}
            setNewClanShopName={setNewClanShopName}
            newClanShopPrice={newClanShopPrice}
            setNewClanShopPrice={setNewClanShopPrice}
            newClanShopDesc={newClanShopDesc}
            setNewClanShopDesc={setNewClanShopDesc}
            newClanShopIcon={newClanShopIcon}
            setNewClanShopIcon={setNewClanShopIcon}
            expandedClanId={expandedClanId}
            setExpandedClanId={setExpandedClanId}
            openImportModal={() => setImportClanModalOpen(true)}
            setClanModalOpen={setClanModalOpen}
            handleDeleteClan={handleDeleteClan}
            handleSave={handleSave}
            authFetch={authFetch}
            selectedGuild={selectedGuild}
            triggerToast={triggerToast}
            fetchClans={fetchClans}
            API_BASE={API_BASE}
          />
        )}

        {tab === 'casino' && (
          <CasinoPage
            casinoSubTab={casinoSubTab}
            setCasinoSubTab={setCasinoSubTab}
            config={config}
            setConfig={setConfig}
            structure={structure}
            handleSave={handleSave}
            getCsvArray={getCsvArray}
            addCsvItem={addCsvItem}
            removeCsvItem={removeCsvItem}
            shopCategory={shopCategory}
            setShopCategory={setShopCategory}
            handleAddShopRole={handleAddShopRole}
            handleDeleteShopRole={handleDeleteShopRole}
            handleAddShopItem={handleAddShopItem}
            handleDeleteShopItem={handleDeleteShopItem}
            handleAddRoleIncome={handleAddRoleIncome}
            handleDeleteRoleIncome={handleDeleteRoleIncome}
            handleSeasonReset={handleSeasonReset}
            newShopIcon={newShopIcon}
            setNewShopIcon={setNewShopIcon}
            newShopRoleId={newShopRoleId}
            setNewShopRoleId={setNewShopRoleId}
            newShopPrice={newShopPrice}
            setNewShopPrice={setNewShopPrice}
            newShopDescription={newShopDescription}
            setNewShopDescription={setNewShopDescription}
            newShopItemIcon={newShopItemIcon}
            setNewShopItemIcon={setNewShopItemIcon}
            newShopItemName={newShopItemName}
            setNewShopItemName={setNewShopItemName}
            newShopItemPrice={newShopItemPrice}
            setNewShopItemPrice={setNewShopItemPrice}
            newShopItemRarity={newShopItemRarity}
            setNewShopItemRarity={setNewShopItemRarity}
            newShopItemDesc={newShopItemDesc}
            setNewShopItemDesc={setNewShopItemDesc}
            newIncomeRoleId={newIncomeRoleId}
            setNewIncomeRoleId={setNewIncomeRoleId}
            newIncomeAmount={newIncomeAmount}
            setNewIncomeAmount={setNewIncomeAmount}
            newIncomeHours={newIncomeHours}
            setNewIncomeHours={setNewIncomeHours}
            newIncomeIsSeasonal={newIncomeIsSeasonal}
            setNewIncomeIsSeasonal={setNewIncomeIsSeasonal}
            seasonalEdits={seasonalEdits}
            setSeasonalEdits={setSeasonalEdits}
            resetConfirmed={resetConfirmed}
            setResetConfirmed={setResetConfirmed}
          />
        )}

        {tab === 'triggers' && (
          <CustomTriggersSettings
            selectedGuild={selectedGuild}
            structure={structure}
            authFetch={authFetch}
            API_BASE={API_BASE}
            triggerToast={triggerToast}
          />
        )}
      </div>

      {/* Modal Crear Clan */}
      <CreateClanModal
        isOpen={clanModalOpen}
        onClose={() => setClanModalOpen(false)}
        newClanName={newClanName}
        setNewClanName={setNewClanName}
        newClanRoleName={newClanRoleName}
        setNewClanRoleName={setNewClanRoleName}
        newClanColor={newClanColor}
        setNewClanColor={setNewClanColor}
        selectedLeaderUser={selectedLeaderUser}
        setSelectedLeaderUser={setSelectedLeaderUser}
        newClanLeaderId={newClanLeaderId}
        setNewClanLeaderId={setNewClanLeaderId}
        leaderSearchQuery={leaderSearchQuery}
        setLeaderSearchQuery={setLeaderSearchQuery}
        isSearchingLeader={isSearchingLeader}
        leaderSearchResults={leaderSearchResults}
        handleCreateClanSubmit={handleCreateClanSubmit}
      />

      {/* Modal Importar Clan */}
      <ImportClanModal
        isOpen={importClanModalOpen}
        onClose={() => setImportClanModalOpen(false)}
        newClanName={newClanName}
        setNewClanName={setNewClanName}
        newClanColor={newClanColor}
        setNewClanColor={setNewClanColor}
        importVoiceChannelId={importVoiceChannelId}
        setImportVoiceChannelId={setImportVoiceChannelId}
        importRoleId={importRoleId}
        setImportRoleId={setImportRoleId}
        unlinkedChannels={unlinkedChannels}
        structure={structure}
        selectedLeaderUser={selectedLeaderUser}
        setSelectedLeaderUser={setSelectedLeaderUser}
        newClanLeaderId={newClanLeaderId}
        setNewClanLeaderId={setNewClanLeaderId}
        leaderSearchQuery={leaderSearchQuery}
        setLeaderSearchQuery={setLeaderSearchQuery}
        isSearchingLeader={isSearchingLeader}
        leaderSearchResults={leaderSearchResults}
        handleImportClanSubmit={handleImportClanSubmit}
      />
    </div>
  );
}
