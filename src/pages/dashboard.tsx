import { useEffect, useState } from "react";
import {
  Card,
  Typography,
  Stack,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
} from "@mui/material";
import { PieChart, Pie, Cell, Legend } from "recharts";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
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

    setTopItems(itemsRes);
    setData(res);
    setPending(pendingRes);
    setStats(statsRes);
  };

  const loadChart = async () => {
    const res = await window.electron.invoke("get-chart-data", filter);
    setChartData(res);
  };

  if (!data) {
    return (
      <Stack alignItems="center" mt={10}>
        <CircularProgress />
      </Stack>
    );
  }

  const format = (n: number) => `${n.toLocaleString("en-IN")}`;
  const COLORS = ["#1976d2", "#2e7d32", "#ed6c02", "#9c27b0", "#d32f2f"];

  const formatMoney = (num: number) => {
    if (num >= 1_00_00_000) {
      return `₹${(num / 1_00_00_000).toFixed(2)} Cr`;
    }
    if (num >= 1_00_000) {
      return `₹${(num / 1_00_000).toFixed(2)} L`;
    }
    return `₹${format(num)}`;
  };

  return (
    <Stack spacing={4} p={4}>
      <Typography variant="h4" fontWeight="bold">
        Dashboard
      </Typography>

      <Stack direction="row" flexWrap="wrap" sx={{ gap: 2 }}>
        <Card sx={{ p: 3, borderLeft: "5px solid #2e7d32" }}>
          <Typography>Cash received</Typography>
          <Typography variant="h5">{formatMoney(data.income)}</Typography>
        </Card>

        <Card sx={{ p: 3, borderLeft: "5px solid #ed6c02" }}>
          <Typography>Client payments</Typography>
          <Typography variant="h5">{formatMoney(data.payments)}</Typography>
        </Card>

        <Card sx={{ p: 3, borderLeft: "5px solid #d32f2f" }}>
          <Typography>Expenses</Typography>
          <Typography variant="h5">{formatMoney(data.expense)}</Typography>
        </Card>

        <Card sx={{ p: 3, borderLeft: "5px solid #1976d2" }}>
          <Typography>Total Revenue</Typography>
          <Typography variant="h5">{formatMoney(data.totalRevenue)}</Typography>
        </Card>

        <Card sx={{ p: 3, borderLeft: "5px solid grey" }}>
          <Typography>Last Month</Typography>
          <Typography variant="h5">
            {formatMoney(stats.lastMonth || 0)}
          </Typography>
        </Card>

        <Card sx={{ p: 3, borderLeft: "5px solid purple" }}>
          <Typography>This Month</Typography>
          <Typography variant="h5">
            {formatMoney(stats.currentMonth || 0)}
          </Typography>
        </Card>

        <Card sx={{ p: 3, borderLeft: "5px solid green" }}>
          <Typography>Today</Typography>
          <Typography variant="h5">{formatMoney(stats.today || 0)}</Typography>
        </Card>

        <Card sx={{ p: 3, borderLeft: "5px solid orange" }}>
          <Typography>This Month Growth</Typography>
          <Typography variant="h5" color={stats.growth >= 0 ? "green" : "red"}>
            {stats.growth || 0}%
          </Typography>
        </Card>

        <Card sx={{ p: 3, borderLeft: "5px solid black" }}>
          <Typography>Customers</Typography>
          <Typography variant="h5">{format(data.totalCustomers)}</Typography>
        </Card>

        <Card sx={{ p: 3, borderLeft: "5px solid red" }}>
          <Typography>Pending</Typography>
          <Typography variant="h5">{formatMoney(data.pending)}</Typography>
        </Card>
      </Stack>

      {/* Filters */}
      <ToggleButtonGroup
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

      {/* Chart */}
      <Card sx={{ p: 3 }}>
        <Typography variant="h6">Sales Analytics</Typography>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="total" stroke="#1976d2" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Bottom Section */}
      <Stack direction="row" spacing={3} flexWrap="wrap">
        {/* Pending */}
        <Card sx={{ p: 3, flex: 1, minWidth: 300 }}>
          <Typography variant="h6">Pending Amounts</Typography>
          <Divider sx={{ my: 2 }} />
          {pending.map((p) => (
            <Typography key={p.name}>
              {p.name} → ₹{p.pending}
            </Typography>
          ))}
        </Card>

        {/* 🔥 Top Items */}
        <Card sx={{ p: 3, flex: 1, minWidth: 300 }}>
          <Typography variant="h6">Top Selling Items</Typography>

          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={topItems}
                dataKey="value"
                nameKey="name"
                outerRadius={80}
                label
              >
                {topItems.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </Stack>
    </Stack>
  );
}
