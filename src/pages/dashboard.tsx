import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import PaymentsIcon from "@mui/icons-material/Payments";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import GroupsIcon from "@mui/icons-material/Groups";
import TodayIcon from "@mui/icons-material/Today";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";

type DashboardData = {
  totalRevenue: number;
  totalCustomers: number;
  totalInvoices: number;
  pending: number;
  income: number;
  payments: number;
  expense: number;
};

const COLORS = ["#1976d2", "#2e7d32", "#ed6c02", "#9c27b0", "#d32f2f"];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [pending, setPending] = useState<any[]>([]);
  const [filter, setFilter] = useState("7");
  const [topItems, setTopItems] = useState<any[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadChart();
  }, [filter]);

  const loadAll = async () => {
    const res = (await window.electron.invoke(
      "get-dashboard",
    )) as DashboardData;

    const pendingRes = await window.electron.invoke("pending-customers");
    const statsRes = await window.electron.invoke("dashboard-stats");
    const itemsRes = await window.electron.invoke("top-items");

    setTopItems(itemsRes || []);
    setData(res);
    setPending(pendingRes || []);
    setStats(statsRes || {});
  };

  const loadChart = async () => {
    const res = await window.electron.invoke("get-chart-data", filter);
    setChartData(res || []);
  };

  if (!data) {
    return (
      <Stack alignItems="center" mt={10}>
        <CircularProgress />
      </Stack>
    );
  }

  const format = (n: number) => `${(n || 0).toLocaleString("en-IN")}`;

  const formatMoney = (num: number) => {
    num = Number(num || 0);
    if (num >= 1_00_00_000) return `₹${(num / 1_00_00_000).toFixed(2)} Cr`;
    if (num >= 1_00_000) return `₹${(num / 1_00_000).toFixed(2)} L`;
    return `₹${format(num)}`;
  };

  const growth = Number(stats.growth || 0);
  const growthUp = growth >= 0;

  const statCard = (opts: {
    title: string;
    value: string;
    icon: ReactNode;
    color: string;
    caption?: string;
  }) => (
    <Card
      sx={{
        flex: "1 1 220px",
        minWidth: 220,
        borderRadius: 3,
        boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
        border: "1px solid #eef1f5",
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            sx={{
              bgcolor: `${opts.color}1a`,
              color: opts.color,
              width: 48,
              height: 48,
              borderRadius: 2.5,
            }}
          >
            {opts.icon}
          </Avatar>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {opts.title}
            </Typography>
            <Typography variant="h5" fontWeight={800}>
              {opts.value}
            </Typography>
          </Box>
        </Stack>
        {opts.caption && (
          <Typography variant="caption" color="text.secondary">
            {opts.caption}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Stack spacing={3} p={4}>
      {/* Header */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={2}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Dashboard
          </Typography>
          <Typography color="text.secondary">
            Overview of your sales, collections and business health.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={`Today: ${formatMoney(stats.today || 0)}`}
            color="primary"
          />
        </Stack>
      </Stack>

      {/* KPI Cards */}
      <Stack direction="row" flexWrap="wrap" sx={{ gap: 2 }}>
        {statCard({
          title: "Total Revenue",
          value: formatMoney(data.totalRevenue),
          icon: <PaymentsIcon />,
          color: "#1976d2",
          caption: `${format(data.totalInvoices)} invoices`,
        })}
        {statCard({
          title: "Cash Received",
          value: formatMoney(data.income),
          icon: <AccountBalanceWalletIcon />,
          color: "#2e7d32",
        })}
        {statCard({
          title: "Client Payments",
          value: formatMoney(data.payments),
          icon: <ReceiptLongIcon />,
          color: "#06b6d4",
        })}
        {statCard({
          title: "Expenses",
          value: formatMoney(data.expense),
          icon: <TrendingDownIcon />,
          color: "#d32f2f",
        })}
        {statCard({
          title: "Receivables (Pending)",
          value: formatMoney(data.pending),
          icon: <ReportProblemIcon />,
          color: "#ed6c02",
        })}
        {statCard({
          title: "Customers",
          value: format(data.totalCustomers),
          icon: <GroupsIcon />,
          color: "#9c27b0",
        })}
      </Stack>

      {/* Month comparison strip */}
      <Stack direction="row" flexWrap="wrap" sx={{ gap: 2 }}>
        <Card
          sx={{
            flex: "1 1 260px",
            borderRadius: 3,
            background: "linear-gradient(135deg, #1976d2, #1256a0)",
            color: "white",
          }}
        >
          <CardContent>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
              <CalendarMonthIcon />
              <Typography sx={{ opacity: 0.85 }}>This Month</Typography>
            </Stack>
            <Typography variant="h4" fontWeight={800}>
              {formatMoney(stats.currentMonth || 0)}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              mt={1}
              sx={{ opacity: growthUp ? 0.95 : 1 }}
            >
              {growthUp ? <TrendingUpIcon /> : <TrendingDownIcon />}
              <Typography fontWeight={700}>{growth}%</Typography>
              <Typography sx={{ opacity: 0.8 }} variant="body2">
                vs last month ({formatMoney(stats.lastMonth || 0)})
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ flex: "1 1 260px", borderRadius: 3 }}>
          <CardContent>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
              <TodayIcon color="action" />
              <Typography color="text.secondary">Today's Sales</Typography>
            </Stack>
            <Typography variant="h4" fontWeight={800} color="primary.main">
              {formatMoney(stats.today || 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              Last month total: {formatMoney(stats.lastMonth || 0)}
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* Charts */}
      <Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
        <Card sx={{ flex: 2, borderRadius: 3, p: 1 }}>
          <CardContent>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={2}
              mb={1}
            >
              <Typography variant="h6" fontWeight={700}>
                Sales Analytics
              </Typography>
              <ToggleButtonGroup
                size="small"
                value={filter}
                exclusive
                onChange={(_, val) => val && setFilter(val)}
              >
                <ToggleButton value="7">7D</ToggleButton>
                <ToggleButton value="15">15D</ToggleButton>
                <ToggleButton value="30">30D</ToggleButton>
                <ToggleButton value="90">90D</ToggleButton>
                <ToggleButton value="month">Monthly</ToggleButton>
                <ToggleButton value="year">Yearly</ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1976d2" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#1976d2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => formatMoney(Number(v))}
                  width={70}
                />
                <Tooltip
                  formatter={(v: any) => [formatMoney(Number(v)), "Sales"]}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#1976d2"
                  strokeWidth={2.5}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 300, borderRadius: 3, p: 1 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <EmojiEventsIcon color="warning" />
              <Typography variant="h6" fontWeight={700}>
                Top Selling Items
              </Typography>
            </Stack>
            {topItems.length === 0 ? (
              <Typography color="text.secondary">No item data yet.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={topItems}
                  layout="vertical"
                  margin={{ left: 20, right: 16 }}
                >
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    width={110}
                  />
                  <Tooltip
                    formatter={(v: any) => [format(Number(v)), "Qty"]}
                    contentStyle={{ borderRadius: 12 }}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {topItems.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Stack>

      {/* Pending customers */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" mb={1}>
            <ReportProblemIcon color="warning" />
            <Typography variant="h6" fontWeight={700}>
              Top Outstanding Dues
            </Typography>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {pending.length === 0 ? (
            <Typography color="text.secondary">
              No pending amounts. 🎉
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {pending.map((p, idx) => {
                const max = Number(pending[0]?.pending || 1);
                const width = Math.max(6, (Number(p.pending) / max) * 100);
                return (
                  <Box key={p.name}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      mb={0.5}
                    >
                      <Typography fontWeight={600} fontSize={14}>
                        {idx + 1}. {p.name}
                      </Typography>
                      <Typography fontWeight={700} color="error.main">
                        ₹{Number(p.pending).toLocaleString("en-IN")}
                      </Typography>
                    </Stack>
                    <Paper
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: "#f1f5f9",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          width: `${width}%`,
                          height: "100%",
                          borderRadius: 4,
                          background:
                            "linear-gradient(90deg, #ff9800, #f44336)",
                        }}
                      />
                    </Paper>
                  </Box>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
