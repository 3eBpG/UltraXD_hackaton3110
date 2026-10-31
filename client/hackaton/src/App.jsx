import { useEffect, useState, useCallback } from 'react';
import './App.css';
import { AppShell, Burger, Text, Box, Button, Flex, Select, Title, Card, MultiSelect, Tabs, SimpleGrid, Badge, Group, List, Table, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import '@mantine/core/styles.css';

import { ReactFlow, Background, Controls, addEdge, Handle, Position, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const SourceNode = ({ id, data }) => {
  const safeDevs = Array.isArray(data.activeDevices) ? data.activeDevices : [];
  const deviceOptions = safeDevs.map(d => ({ value: d.id, label: d.name }));
  const dev = safeDevs.find(d => d.id === data.dev);
  
  let signalOptions = [];
  if (dev && dev.signals) {
    signalOptions = Object.entries(dev.signals)
      .filter(([name, info]) => typeof info === 'object' && (info.management === 'r' || info.management === 'rw') && info.kind !== 'system')
      .map(([name]) => ({ value: name, label: name }));
  }

  return (
    <Card withBorder padding="sm" style={{ width: 220, background: '#fff' }}>
      <Handle type="source" position={Position.Right} style={{ background: '#aa3bff' }} />
      <Text fw={500} size="sm" mb="xs">1. Источник</Text>
      <Select placeholder="Устройство" data={deviceOptions} value={data.dev} onChange={(v) => data.onChange(id, 'dev', v)} size="xs" mb="xs" />
      <Select placeholder="Сигнал" data={signalOptions} value={data.sig} onChange={(v) => data.onChange(id, 'sig', v)} disabled={!data.dev} size="xs" />
    </Card>
  );
};

const LogicNode = ({ id, data }) => {
  const safeBlocks = Array.isArray(data.logicBlocks) ? data.logicBlocks : [];
  const logicOptions = safeBlocks.filter(b => b.block_type === 'logic').map(b => ({ value: b.id, label: b.name }));

  return (
    <Card withBorder padding="sm" style={{ width: 200, background: '#fff' }}>
      <Handle type="target" position={Position.Left} style={{ background: '#aa3bff' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#aa3bff' }} />
      <Text fw={500} size="sm" mb="xs">Логика</Text>
      <Select placeholder="Действие" data={logicOptions} value={data.logicId} onChange={(v) => data.onChange(id, 'logicId', v)} size="xs" />
    </Card>
  );
};

const BranchNode = ({ id, data }) => {
  const safeBlocks = Array.isArray(data.logicBlocks) ? data.logicBlocks : [];
  const branchOptions = safeBlocks.filter(b => b.block_type === 'branch').map(b => ({ value: b.id, label: b.name }));

  return (
    <Card withBorder padding="sm" style={{ width: 200, background: '#fff' }}>
      <Handle type="target" position={Position.Left} style={{ background: '#aa3bff' }} />
      <Text fw={500} size="sm" mb="xs">Ветвление</Text>
      <Select placeholder="Условие" data={branchOptions} value={data.branchId} onChange={(v) => data.onChange(id, 'branchId', v)} size="xs" />
      <div style={{ position: 'absolute', right: -15, top: '35%', fontSize: 11, color: 'green', fontWeight: 'bold' }}>Да</div>
      <Handle type="source" position={Position.Right} id="true" style={{ background: 'green', top: '40%' }} />
      <div style={{ position: 'absolute', right: -15, top: '65%', fontSize: 11, color: 'red', fontWeight: 'bold' }}>Нет</div>
      <Handle type="source" position={Position.Right} id="false" style={{ background: 'red', top: '70%' }} />
    </Card>
  );
};

const TargetNode = ({ id, data }) => {
  const safeDevs = Array.isArray(data.activeDevices) ? data.activeDevices : [];
  const deviceOptions = safeDevs.map(d => ({ value: d.id, label: d.name }));
  const dev = safeDevs.find(d => d.id === data.dev);
  
  let signalOptions = [];
  if (dev && dev.signals) {
    signalOptions = Object.entries(dev.signals)
      .filter(([name, info]) => typeof info === 'object' && (info.management === 'w' || info.management === 'rw') && info.kind !== 'system')
      .map(([name]) => ({ value: name, label: name }));
  }

  return (
    <Card withBorder padding="sm" style={{ width: 220, background: '#fff', borderColor: '#aa3bff' }}>
      <Handle type="target" position={Position.Left} style={{ background: '#aa3bff' }} />
      <Text fw={500} size="sm" mb="xs" c="violet">3. Цель</Text>
      <Select placeholder="Устройство" data={deviceOptions} value={data.dev} onChange={(v) => data.onChange(id, 'dev', v)} size="xs" mb="xs" />
      <Select placeholder="Сигнал" data={signalOptions} value={data.sig} onChange={(v) => data.onChange(id, 'sig', v)} disabled={!data.dev} size="xs" />
    </Card>
  );
};

const nodeTypes = { source: SourceNode, logic: LogicNode, branch: BranchNode, target: TargetNode };

export function BasicAppShell() {
  const [opened, { toggle }] = useDisclosure();
  
  const [allDevices, setAllDevices] = useState([]); 
  const [activeDevices, setActiveDevices] = useState([]); 
  const [liveStates, setLiveStates] = useState({}); 
  const [logicBlocks, setLogicBlocks] = useState([]);
  const [savedScenarios, setSavedScenarios] = useState([]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onNodeDataChange = useCallback((id, field, value) => {
    setNodes((nds) => nds.map((node) => {
      if (node.id === id) return { ...node, data: { ...node.data, [field]: value } };
      return node;
    }));
  }, [setNodes]);

  const resetCanvas = () => {
    const ts = Date.now();
    setNodes([
      { id: `source-${ts}`, type: 'source', position: { x: 50, y: 150 }, data: { onChange: onNodeDataChange, activeDevices, logicBlocks } },
      { id: `target-${ts+1}`, type: 'target', position: { x: 650, y: 150 }, data: { onChange: onNodeDataChange, activeDevices, logicBlocks } }
    ]);
    setEdges([]);
  };

  useEffect(() => {
    resetCanvas();
  }, []);

  useEffect(() => {
    setNodes((nds) => nds.map(n => ({ ...n, data: { ...n.data, activeDevices, logicBlocks } })));
  }, [activeDevices, logicBlocks, setNodes]);

  useEffect(() => {
    fetch('http://localhost:9000/api/devices/available').then(res => res.json()).then(data => setAllDevices(Array.isArray(data) ? data : [])).catch(console.error);
    fetch('http://localhost:9000/api/logic_blocks').then(res => res.json()).then(data => setLogicBlocks(Array.isArray(data) ? data : [])).catch(console.error);
    loadActiveDevices();
    loadScenarios();

    const interval = setInterval(() => {
      fetch('http://localhost:9000/api/live_state').then(res => res.json()).then(data => setLiveStates(data || {})).catch(console.error);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadActiveDevices = () => {
    fetch('http://localhost:9000/api/devices').then(res => res.json()).then(data => setActiveDevices(Array.isArray(data) ? data : [])).catch(console.error);
  };

  const loadScenarios = () => {
    fetch('http://localhost:9000/api/pipelines').then(res => res.json()).then(data => setSavedScenarios(Array.isArray(data) ? data : [])).catch(console.error);
  };

  const handleSelectDevices = (ids) => {
    const safeIds = Array.isArray(ids) ? ids : [];
    fetch('http://localhost:9000/api/devices/select', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devices: safeIds })
    }).then(() => setTimeout(() => loadActiveDevices(), 1000)).catch(console.error);
  };

  const addNode = (type) => {
    setNodes((nds) => [...nds, {
      id: `${type}-${Date.now()}`, type: type,
      position: { x: 300, y: 100 + Math.random() * 200 },
      data: { onChange: onNodeDataChange, logicBlocks, activeDevices }
    }]);
  };

  const handleSave = () => {
    fetch('http://localhost:9000/api/pipelines', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes, edges })
    }).then(() => { loadScenarios(); alert("Сценарий сохранен и запущен!"); });
  };

  const safeAllDevices = Array.isArray(allDevices) ? allDevices : [];
  const safeActiveDevices = Array.isArray(activeDevices) ? activeDevices : [];
  const safeScenarios = Array.isArray(savedScenarios) ? savedScenarios : [];

  // Группировка сценариев по ID
  const groupedScenarios = safeScenarios.reduce((acc, s) => {
    if (!s || !s.id) return acc;
    if (!acc[s.id]) acc[s.id] = [];
    acc[s.id].push(s);
    return acc;
  }, {});

  return (
    <AppShell padding="md" header={{ height: 60 }}>
      <AppShell.Header>
        <Flex align="center" h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Text size="xl" fw={700} ml="md">Ujin Scenario Builder</Text>
        </Flex>
      </AppShell.Header>

      <AppShell.Main>
        <Box p="md" style={{ maxWidth: 1200, margin: '0 auto' }}>
          
          <Card shadow="sm" p="lg" radius="md" withBorder mb="xl" bg="gray.1">
            <Title order={4} mb="md">Выберите активные устройства</Title>
            <MultiSelect
              data={safeAllDevices.map(d => ({ value: d.id, label: d.name }))}
              value={safeActiveDevices.map(d => d.id)}
              onChange={handleSelectDevices}
              placeholder="Выберите устройства для запуска..."
              hidePickedOptions
            />
          </Card>

          <Tabs defaultValue="nodes" color="violet">
            <Tabs.List mb="md">
              <Tabs.Tab value="nodes">Визуальный конструктор</Tabs.Tab>
              <Tabs.Tab value="monitor">Мониторинг устройств</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="nodes">
              <Flex justify="space-between" mb="md" align="center">
                <Group>
                  <Button onClick={() => addNode('logic')} variant="light" color="violet">+ Логика</Button>
                  <Button onClick={() => addNode('branch')} variant="light" color="blue">+ Ветвление</Button>
                  <Button onClick={() => addNode('target')} variant="light" color="grape">+ Выход</Button>
                  <Button onClick={resetCanvas} variant="outline" color="red">Очистить холст</Button>
                </Group>
                <Button onClick={handleSave} color="green">Сохранить сценарий</Button>
              </Flex>
              
              <Box style={{ height: '500px', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fafafa', marginBottom: '20px' }}>
                <ReactFlow 
                  nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} 
                  nodeTypes={nodeTypes} fitView
                >
                  <Background color="#ccc" gap={16} />
                  <Controls />
                </ReactFlow>
              </Box>

              <Title order={4} mb="sm">Сохраненные сценарии:</Title>
              {Object.keys(groupedScenarios).length === 0 ? (
                <Text c="dimmed" mb="xl">Нет сохраненных сценариев</Text>
              ) : (
                <Stack gap="sm" mb="xl">
                  {Object.entries(groupedScenarios).map(([id, paths]) => (
                    <Card key={id} shadow="sm" p="md" radius="md" withBorder>
                      <Group justify="space-between" mb="xs">
                        <Text fw={700} size="sm" c="violet">Сценарий #{id.slice(-4)}</Text>
                        <Button 
                          size="xs" color="red" variant="light"
                          onClick={() => {
                            if (window.confirm("Удалить этот сценарий целиком?")) {
                              fetch('http://localhost:9000/api/pipelines', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: id })
                              }).then(() => loadScenarios());
                            }
                          }}
                        >
                          Удалить
                        </Button>
                      </Group>
                      <List size="sm" type="ordered" spacing="xs">
                        {paths.map((p, i) => <List.Item key={i}>{p.text}</List.Item>)}
                      </List>
                    </Card>
                  ))}
                </Stack>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="monitor">
              {safeActiveDevices.length === 0 ? (
                <Text c="dimmed" ta="center" mt="xl">Нет запущенных устройств. Выберите их сверху.</Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                  {safeActiveDevices.map(dev => {
                    const state = liveStates[dev.id]?.signals || {};
                    const isOffline = state.status === "Не отвечает";
                    return (
                      <Card key={dev.id} shadow="sm" p="lg" radius="md" withBorder>
                        <Group justify="space-between" mb="md">
                          <Text fw={700} size="lg">{dev.name}</Text>
                          <Badge color={isOffline ? "red" : "green"}>{isOffline ? "OFFLINE" : "ONLINE"}</Badge>
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

function App() { return <BasicAppShell />; }
export default App;