import { useEffect, useState, useCallback, useRef } from 'react';
import './App.css';
import { AppShell, Burger, Text, Box, Button, Flex, Select, Title, Card, Tabs, SimpleGrid, Badge, Group, List, Table, Stack, Paper, TextInput, Slider } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import '@mantine/core/styles.css';

import { ReactFlow, Background, Controls, addEdge, Handle, Position, useNodesState, useEdgesState, useReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';


const DeviceNode = ({ id, data }) => {
  const isSource = data.role === 'source';
  const safeDevs = Array.isArray(data.activeDevices) ? data.activeDevices : [];
  const dev = safeDevs.find(d => d.id === data.dev);
  
  let signalOptions = [];
  if (dev && dev.signals) {
    signalOptions = Object.entries(dev.signals)
      .filter(([name, info]) => {
        if (typeof info !== 'object' || info.kind === 'system') return false;
        if (isSource) return info.management === 'r' || info.management === 'rw';
        return info.management === 'w' || info.management === 'rw';
      })
      .map(([name]) => ({ value: name, label: name }));
  }

  const signals = data.signals || [];

  const updateSignal = (idx, sigName) => {
    const newSignals = [...signals];
    if (!newSignals[idx]) newSignals[idx] = { handleId: `${id}-${idx}`, signalName: null };
    newSignals[idx].signalName = sigName;
    data.onChange(id, 'signals', newSignals);
  };

  const maxSlots = signalOptions.length > 0 ? signalOptions.length : 1;
  const numSlots = Math.min(signals.length + 1, maxSlots);

  return (
    <Card 
      withBorder 
      padding="sm" 
      style={{ 
        width: 240, background: '#fff', position: 'relative', overflow: 'visible',
        borderColor: isSource ? '#e0e0e0' : '#aa3bff', 
        borderWidth: isSource ? 1 : 2
      }}
    >
      <Group justify="space-between" mb="xs">
        <Text fw={700} size="sm" c={isSource ? 'dark' : 'violet'}>
          {isSource ? 'Источник' : 'Цель'}
        </Text>
        <Badge color={isSource ? 'gray' : 'violet'} size="sm">
          {data.devName || 'Устройство'}
        </Badge>
      </Group>
      
      <div style={{ marginTop: 15 }}>
        {Array.from({ length: numSlots }).map((_, idx) => {
          const sigObj = signals[idx] || { handleId: `${id}-${idx}`, signalName: null };
          return (
            <div key={idx} style={{ position: 'relative', marginBottom: 8 }}>
              <Handle 
                type={isSource ? 'source' : 'target'} 
                id={sigObj.handleId} 
                position={isSource ? Position.Right : Position.Left} 
                style={{ 
                  background: sigObj.signalName ? '#aa3bff' : '#dcdcdc', 
                  width: 16, height: 16, 
                  [isSource ? 'right' : 'left']: -23, top: '50%'
                }} 
              />
              <Select 
                placeholder={`Параметр ${idx + 1}`} 
                data={signalOptions.filter(opt => !signals.some(s => s?.signalName === opt.value && s.handleId !== sigObj.handleId))}
                value={sigObj.signalName} 
                onChange={(v) => updateSignal(idx, v)} 
                size="xs" 
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const LogicNode = ({ id, data }) => {
  const safeBlocks = Array.isArray(data.logicBlocks) ? data.logicBlocks : [];
  const logicOptions = safeBlocks.filter(b => b.block_type === 'logic').map(b => ({ value: b.id, label: b.name }));

  return (
    <Card withBorder padding="sm" style={{ width: 220, background: '#fff', position: 'relative', overflow: 'visible' }}>
      <Handle type="target" id="in" position={Position.Left} style={{ width: 16, height: 16, background: '#aa3bff', left: -9, top: '30%' }} />
      <Handle type="source" id="out" position={Position.Right} style={{ width: 16, height: 16, background: '#aa3bff', right: -9, top: '30%' }} />
      
      <Text fw={500} size="sm" mb="xs">Логика</Text>
      <Select 
        placeholder="Действие" 
        data={logicOptions} 
        value={data.logicId} 
        onChange={(v) => data.onChange(id, 'logicId', v)} 
        size="xs" 
      />

      {}
      {data.logicId === 'percentage' && (
        <Box mt="md">
          <Group justify="space-between" mb={5}>
            <Text size="xs" fw={500}>Мощность:</Text>
            <Badge size="sm" color="violet">{data.percent ?? 50}%</Badge>
          </Group>
          <Slider 
            value={data.percent ?? 50} 
            onChange={(v) => data.onChange(id, 'percent', v)} 
            min={0} 
            max={100} 
            step={1}
            color="violet"
            size="sm"
          />
        </Box>
      )}
    </Card>
  );
};

const BranchNode = ({ id, data }) => {
  const safeBlocks = Array.isArray(data.logicBlocks) ? data.logicBlocks : [];
  const branchOptions = safeBlocks.filter(b => b.block_type === 'branch').map(b => ({ value: b.id, label: b.name }));

  return (
    <Card withBorder padding="sm" style={{ width: 200, background: '#fff', position: 'relative', overflow: 'visible' }}>
      <Handle type="target" id="in" position={Position.Left} style={{ width: 16, height: 16, background: '#aa3bff', left: -9, top: '50%' }} />
      <Text fw={500} size="sm" mb="xs">Ветвление</Text>
      <Select placeholder="Условие" data={branchOptions} value={data.branchId} onChange={(v) => data.onChange(id, 'branchId', v)} size="xs" />
      
      <div style={{ position: 'absolute', right: -15, top: '25%', fontSize: 11, color: 'green', fontWeight: 'bold' }}>Да</div>
      <Handle type="source" id="true" position={Position.Right} style={{ background: 'green', width: 16, height: 16, right: -9, top: '30%' }} />
      
      <div style={{ position: 'absolute', right: -15, top: '65%', fontSize: 11, color: 'red', fontWeight: 'bold' }}>Нет</div>
      <Handle type="source" id="false" position={Position.Right} style={{ background: 'red', width: 16, height: 16, right: -9, top: '70%' }} />
    </Card>
  );
};

const nodeTypes = { device: DeviceNode, logic: LogicNode, branch: BranchNode };

function FlowBuilder() {
  const [opened, { toggle }] = useDisclosure();
  const reactFlowWrapper = useRef(null);
  const [rfInstance, setRfInstance] = useState(null);

  const [allDevices, setAllDevices] = useState([]); 
  const [activeDevices, setActiveDevices] = useState([]); 
  const [liveStates, setLiveStates] = useState({}); 
  const [logicBlocks, setLogicBlocks] = useState([]);
  const [savedScenarios, setSavedScenarios] = useState([]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const isValidConnection = useCallback((connection) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    if (!sourceNode || !targetNode) return false;
    return true;
  }, [nodes]);

  const deleteEdgesForNode = useCallback((nodeId) => {
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
  }, [setEdges]);

  const onNodeDataChange = useCallback((id, field, value) => {
    setNodes((nds) => nds.map((node) => {
      if (node.id === id) return { ...node, data: { ...node.data, [field]: value } };
      return node;
    }));
  }, [setNodes]);

  const onDropToActive = useCallback((event) => {
    event.preventDefault();
    const deviceId = event.dataTransfer.getData('deviceId');
    if (!deviceId || activeDevices.some(d => d.id === deviceId)) return;

    const newActiveIds = [...activeDevices.map(d => d.id), deviceId];
    
    const devObj = allDevices.find(d => d.id === deviceId);
    if (devObj) setActiveDevices(prev => [...prev, devObj]);

    fetch('http://localhost:9000/api/devices/select', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devices: newActiveIds })
    }).catch(console.error);
  }, [activeDevices, allDevices]);

  const onDropCanvas = useCallback((event) => {
    event.preventDefault();
    const devId = event.dataTransfer.getData('deviceId');
    const devName = event.dataTransfer.getData('deviceName');
    
    if (!devId || !rfInstance) return;

    const role = event.shiftKey ? 'target' : 'source';

    const position = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const newNodeId = `device-${Date.now()}`;

    const newNode = {
      id: newNodeId,
      type: 'device',
      position,
      data: {
        role: role, 
        dev: devId,
        devName: devName,
        onChange: onNodeDataChange,
        onDeleteEdges: deleteEdgesForNode,
        activeDevices,
        logicBlocks,
        signals: []
      }
    };

    setNodes((nds) => nds.concat(newNode));
  }, [rfInstance, activeDevices, logicBlocks, onNodeDataChange, deleteEdgesForNode, setNodes]);
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const resetCanvas = () => {
    setNodes([]);
    setEdges([]);
  };

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

  useEffect(() => {
    setNodes((nds) => nds.map(n => ({ ...n, data: { ...n.data, activeDevices, logicBlocks, onDeleteEdges: deleteEdgesForNode } })));
  }, [activeDevices, logicBlocks, setNodes, deleteEdgesForNode]);

  const loadActiveDevices = () => {
    fetch('http://localhost:9000/api/devices').then(res => res.json()).then(data => setActiveDevices(Array.isArray(data) ? data : [])).catch(console.error);
  };

  const loadScenarios = () => {
    fetch('http://localhost:9000/api/pipelines').then(res => res.json()).then(data => setSavedScenarios(Array.isArray(data) ? data : [])).catch(console.error);
  };

  const addNode = (type) => {
    const ts = Date.now();
    setNodes((nds) => [...nds, {
      id: `${type}-${ts}`, type: type,
      position: { x: 300, y: 100 + Math.random() * 200 },
      data: { 
        onChange: onNodeDataChange, logicBlocks, activeDevices, onDeleteEdges: deleteEdgesForNode,
        signals: []
      }
    }]);
  };

  const handleSave = () => {
    fetch('http://localhost:9000/api/pipelines', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes, edges })
    }).then(() => { loadScenarios(); alert("Сценарий сохранен и запущен!"); });
  };

  const safeScenarios = Array.isArray(savedScenarios) ? savedScenarios : [];
  const groupedScenarios = safeScenarios.reduce((acc, s) => {
    if (!s || !s.id) return acc;
    if (!acc[s.id]) acc[s.id] = [];
    acc[s.id].push(s);
    return acc;
  }, {});

  const renderBubble = (dev, type = 'available') => (
    <Paper
      key={dev.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('deviceId', dev.id);
        e.dataTransfer.setData('deviceName', dev.name);
        e.dataTransfer.setData('nodeType', type);
        e.dataTransfer.effectAllowed = 'move';
      }}
      shadow="xs" radius="xl" p="xs" px="md" withBorder
      style={{ cursor: 'grab', background: type === 'source' ? '#f8f9fa' : type === 'target' ? '#f3e8ff' : '#fff', marginBottom: 8 }}
    >
      <Text size="sm" fw={500}>{dev.name}</Text>
    </Paper>
  );

  return (
    <AppShell padding="md" header={{ height: 60 }}>
      <AppShell.Header>
        <Flex align="center" h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Text size="xl" fw={700} ml="md">Ujin Scenario Builder</Text>
        </Flex>
      </AppShell.Header>

      <AppShell.Main>
        <Flex gap="md" h="calc(100vh - 100px)">
          {/* ЛЕВАЯ ПАНЕЛЬ С D&D */}
          <Box style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            <Card withBorder padding="sm" bg="gray.0">
              <Title order={5} mb="sm">Доступные устройства</Title>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {allDevices.filter(d => !activeDevices.some(a => a.id === d.id)).map(d => renderBubble(d, 'available'))}
              </div>
            </Card>

            <Card withBorder padding="sm" bg="blue.0" style={{ flex: 1, borderStyle: 'dashed' }}
              onDrop={onDropToActive} onDragOver={onDragOver}
            >
              <Title order={5} mb="sm" c="blue.9">Активные (перетащи сюда)</Title>
              <div style={{ maxHeight: '100%', overflowY: 'auto' }}>
                {activeDevices.map(d => renderBubble(d, 'source'))}
                {activeDevices.length === 0 && <Text size="xs" c="dimmed" ta="center">Перетащи устройства из списка выше</Text>}
              </div>
            </Card>

          </Box>

          {}
          <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Tabs defaultValue="nodes" color="violet" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Tabs.List mb="md">
                <Tabs.Tab value="nodes">Визуальный конструктор</Tabs.Tab>
                <Tabs.Tab value="monitor">Мониторинг</Tabs.Tab>
                <Box style={{ flex: 1 }} />
                <Group p="xs">
                  <Button size="xs" onClick={() => addNode('logic')} variant="light" color="violet">+ Логика</Button>
                  <Button size="xs" onClick={() => addNode('branch')} variant="light" color="blue">+ Ветвление</Button>
                  <Button size="xs" onClick={resetCanvas} variant="outline" color="red">Очистить</Button>
                  <Button size="xs" onClick={handleSave} color="green">Сохранить</Button>
                </Group>
              </Tabs.List>

              <Tabs.Panel value="nodes" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                
                {/* ИНСТРУКЦИЯ */}
                <Paper p="xs" mb="sm" bg="yellow.0" radius="sm">
                  <Text size="xs" c="yellow.9">
                    <b>Совет:</b> Перетащи активное устройство на холст как <b>Вход</b> (источник), удерживая <kbd>Shift</kbd> — как <b>Выход</b> (цель). Или используй кнопки ниже.
                  </Text>
                </Paper>

                <Box ref={reactFlowWrapper} style={{ flex: 1, border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fafafa', position: 'relative' }}
                  onDrop={onDropCanvas} onDragOver={onDragOver}
                >
                  <ReactFlow 
                    nodes={nodes} edges={edges} 
                    onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} 
                    onConnect={onConnect}
                    isValidConnection={isValidConnection}
                    nodeTypes={nodeTypes} 
                    onInit={setRfInstance}
                    fitView
                  >
                    <Background color="#ccc" gap={16} />
                    <Controls />
                  </ReactFlow>
                </Box>

                <Box mt="md" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  <Title order={5} mb="sm">Сохраненные сценарии:</Title>
                  {Object.keys(groupedScenarios).length === 0 ? (
                    <Text c="dimmed" size="sm">Нет сценариев</Text>
                  ) : (
                    <Stack gap="xs">
                      {Object.entries(groupedScenarios).map(([id, paths]) => (
                        <Card key={id} shadow="sm" p="xs" radius="sm" withBorder>
                          <Group justify="space-between" mb={4}>
                            <Text fw={700} size="xs" c="violet">Сценарий #{id.slice(-4)}</Text>
                            <Button size="compact-xs" color="red" variant="subtle" onClick={() => {
                                fetch('http://localhost:9000/api/pipelines', {
                                  method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: id })
                                }).then(() => loadScenarios());
                            }}>Удалить</Button>
                          </Group>
                          <List size="xs" type="ordered">
                            {paths.map((p, i) => <List.Item key={i}>{p.text}</List.Item>)}
                          </List>
                        </Card>
                      ))}
                    </Stack>
                  )}
                </Box>
              </Tabs.Panel>

              <Tabs.Panel value="monitor" style={{ flex: 1, overflowY: 'auto' }}>
                 <SimpleGrid cols={{ base: 1, sm: 2, md: 2 }} spacing="md">
                  {activeDevices.map(dev => {
                    const state = liveStates[dev.id]?.signals || {};
                    const isOffline = state.status === "Не отвечает";
                    return (
                      <Card key={dev.id} shadow="sm" p="md" radius="md" withBorder>
                        <Group justify="space-between" mb="sm">
                          <Text fw={700}>{dev.name}</Text>
                          <Badge color={isOffline ? "red" : "green"}>{isOffline ? "OFFLINE" : "ONLINE"}</Badge>
                        </Group>
                        {!isOffline && (
                          <Table variant="vertical" layout="fixed" withRowBorders={false}>
                            <Table.Tbody>
                              {Object.entries(state).map(([sigName, sigValue]) => (
                                <Table.Tr key={sigName}>
                                  <Table.Th w="50%" py={4} style={{ border: 0 }}>{sigName}</Table.Th>
                                  <Table.Td fw={500} c="violet" py={4} style={{ border: 0 }}>{String(sigValue)}</Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        )}
                      </Card>
                    );
                  })}
                </SimpleGrid>
              </Tabs.Panel>
            </Tabs>
          </Box>
        </Flex>
      </AppShell.Main>
    </AppShell>
  );
}

export function BasicAppShell() {
  return (
    <ReactFlowProvider>
      <FlowBuilder />
    </ReactFlowProvider>
  );
}

function App() { return <BasicAppShell />; }
export default App;