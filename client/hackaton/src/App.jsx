import { useEffect, useState } from 'react';
import './App.css';
import { AppShell, Burger, Text, Box, Button, Flex, Select, Table, Title, Card, Stack, MultiSelect, Tabs, SimpleGrid, Badge, Group, Divider } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import '@mantine/core/styles.css';

export function BasicAppShell() {
  const [opened, { toggle }] = useDisclosure();
  
  const [allDevices, setAllDevices] = useState([]); 
  const [activeDevices, setActiveDevices] = useState([]); 
  const [liveStates, setLiveStates] = useState({}); 
  
  const [logicBlocks, setLogicBlocks] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  
  const [sourceDevice, setSourceDevice] = useState(null);
  const [sourceSignal, setSourceSignal] = useState(null);
  const [logicId, setLogicId] = useState(null);
  const [targetDevice, setTargetDevice] = useState(null);
  const [targetSignal, setTargetSignal] = useState(null);

  useEffect(() => {
    fetch('http://localhost:9000/api/devices/available')
      .then(res => res.json()).then(data => setAllDevices(data)).catch(console.error);
      
    fetch('http://localhost:9000/api/logic_blocks')
      .then(res => res.json()).then(data => setLogicBlocks(data)).catch(console.error);
      
    loadActiveDevices();
    loadPipelines();

    const interval = setInterval(() => {
      fetch('http://localhost:9000/api/live_state')
        .then(res => res.json())
        .then(data => setLiveStates(data))
        .catch(console.error);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const loadActiveDevices = () => {
    fetch('http://localhost:9000/api/devices')
      .then(res => res.json()).then(data => setActiveDevices(data)).catch(console.error);
  };

  const loadPipelines = () => {
    fetch('http://localhost:9000/api/pipelines')
      .then(res => res.json()).then(data => setPipelines(data)).catch(console.error);
  };

  const handleSelectDevices = (ids) => {
    const newIds = ids || [];
    fetch('http://localhost:9000/api/devices/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devices: newIds })
    }).then(() => {
      setTimeout(() => {
        loadActiveDevices();
        setSourceDevice(null);
        setTargetDevice(null);
      }, 1000); 
    }).catch(console.error);
  };

  const handleCreate = () => {
    if (!sourceDevice || !sourceSignal || !targetDevice || !targetSignal || !logicId) return;

    fetch('http://localhost:9000/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_device: sourceDevice, source_signal: sourceSignal,
        target_device: targetDevice, target_signal: targetSignal, logic_id: logicId
      })
    }).then(() => {
      loadPipelines();
      setSourceSignal(null); setTargetSignal(null); setLogicId(null);
    });
  };

  const getDeviceOptions = () => {
    if (!Array.isArray(activeDevices)) return [];
    return activeDevices.map(d => ({ value: d.id, label: d.name }));
  };

  const getSignalOptions = (devId, mode) => {
    if (!Array.isArray(activeDevices)) return [];
    const dev = activeDevices.find(d => d.id === devId);
    if (!dev || !dev.signals) return [];

    return Object.entries(dev.signals)
      .filter(([name, info]) => {
        if (typeof info === 'object' && info !== null) {
          if (info.kind === "system") return false;
          if (mode === "source") return info.management === "r" || info.management === "rw";
          if (mode === "target") return info.management === "w" || info.management === "rw";
        }
        return true;
      })
      .map(([name]) => ({ value: name, label: name }));
  };

  return (
    <AppShell padding="md" header={{ height: 60 }}>
      <AppShell.Header>
        <Flex align="center" h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Text size="xl" fw={700} ml="md">Ujin Scenario Builder</Text>
        </Flex>
      </AppShell.Header>

      <AppShell.Main>
        <Box p="md" style={{ maxWidth: 1100, margin: '0 auto' }}>
          
          <Card shadow="sm" p="lg" radius="md" withBorder mb="xl" bg="gray.1">
            <Title order={4} mb="md">Выберите активные устройства</Title>
            <MultiSelect
              data={Array.isArray(allDevices) ? allDevices.map(d => ({ value: d.id, label: d.name })) : []}
              value={Array.isArray(activeDevices) ? activeDevices.map(d => d.id) : []}
              onChange={handleSelectDevices}
              placeholder="Выберите устройства для запуска..."
              hidePickedOptions
            />
          </Card>

          <Tabs defaultValue="builder" color="violet">
            <Tabs.List mb="md">
              <Tabs.Tab value="builder">Редактор сценариев</Tabs.Tab>
              <Tabs.Tab value="monitor">Мониторинг устройств</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="builder">
              <Card shadow="sm" p="lg" radius="md" withBorder mb="xl">
                <Title order={3} mb="md">Создать сценарий</Title>
                <Flex gap="lg" align="flex-end" wrap="wrap">
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>1. Источник (Если)</Text>
                    <Select placeholder="Устройство" data={getDeviceOptions()} value={sourceDevice} onChange={setSourceDevice} w={180} />
                    <Select placeholder="Сигнал" data={getSignalOptions(sourceDevice, "source")} value={sourceSignal} onChange={setSourceSignal} disabled={!sourceDevice} w={180} />
                  </Stack>
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>2. Логика (То)</Text>
                    <Select placeholder="Действие" data={Array.isArray(logicBlocks) ? logicBlocks.map(b => ({ value: b.id, label: b.name })) : []} value={logicId} onChange={setLogicId} w={220} />
                  </Stack>
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>3. Цель (Применить)</Text>
                    <Select placeholder="Устройство" data={getDeviceOptions()} value={targetDevice} onChange={setTargetDevice} w={180} />
                    <Select placeholder="Сигнал" data={getSignalOptions(targetDevice, "target")} value={targetSignal} onChange={setTargetSignal} disabled={!targetDevice} w={180} />
                  </Stack>
                  <Button onClick={handleCreate} color="violet" h={36} ml="auto">Создать</Button>
                </Flex>
              </Card>

              <Title order={3} mb="md">Активные сценарии</Title>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr><Table.Th>Из сигнала</Table.Th><Table.Th>Действие</Table.Th><Table.Th>В сигнал</Table.Th></Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {!Array.isArray(pipelines) || pipelines.length === 0 ? (
                    <Table.Tr><Table.Td colSpan={3} align="center">Нет сценариев</Table.Td></Table.Tr>
                  ) : (
                    pipelines.map((p, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>{p.source}</Table.Td>
                        <Table.Td fw={500} c="violet">{p.logic}</Table.Td>
                        <Table.Td>{p.target}</Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>

            <Tabs.Panel value="monitor">
              {!Array.isArray(activeDevices) || activeDevices.length === 0 ? (
                <Text c="dimmed" ta="center" mt="xl">Нет запущенных устройств. Выберите их в панели сверху.</Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                  {activeDevices.map(dev => {
                    const state = liveStates[dev.id]?.signals || {};
                    const isOffline = state.status === "Не отвечает";
                    
                    return (
                      <Card key={dev.id} shadow="sm" p="lg" radius="md" withBorder>
                        <Group justify="space-between" mb="md">
                          <Text fw={700} size="lg">{dev.name}</Text>
                          <Badge color={isOffline ? "red" : "green"}>
                            {isOffline ? "OFFLINE" : "ONLINE"}
                          </Badge>
                        </Group>
                        
                        {!isOffline && (
                          <Table variant="vertical" layout="fixed">
                            <Table.Tbody>
                              {Object.entries(state).map(([sigName, sigValue]) => (
                                <Table.Tr key={sigName}>
                                  <Table.Th w="60%">{sigName}</Table.Th>
                                  <Table.Td fw={500} c="violet">{String(sigValue)}</Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        )}
                      </Card>
                    );
                  })}
                </SimpleGrid>
              )}
            </Tabs.Panel>
          </Tabs>

        </Box>
      </AppShell.Main>
    </AppShell>
  );
}

function App() {
  return <BasicAppShell />;
}

export default App;