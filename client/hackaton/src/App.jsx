
import './App.css'
import { AppShell, Burger, Group, Text, Box, Button, Flex, Center, Transition, SimpleGrid  } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {Link, Router, Route} from 'react-router';
import '@mantine/core/styles.css' 


export function BasicAppShell() {
  const [opened, { toggle }] = useDisclosure();
  const isMobile = useMediaQuery('(max-width: 48em)')
  const boxMargin = 20;

  return (
    <AppShell
      padding="md"
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
    >
      <AppShell.Header>
        <Burger
          opened={opened}
          onClick={toggle}
          hiddenFrom="sm"
          size="sm"
        />

        <div>Logo</div>
      </AppShell.Header>

      <AppShell.Navbar>Navbar</AppShell.Navbar>
      <Transition mounted={isMobile}>
        {
          () => (
          
            <Box style={{

            position: 'fixed',
            display: "Flex",
            justifyContent: 'space-around',
            alignItems: 'Center',
            height: '50px',
            bottom: boxMargin,
            left: boxMargin,
            right: boxMargin,
            zIndex: '100px',
            
          }}>
            <SimpleGrid cols={{base: 2, xs: 4}} 
            style={{border: '2px solid black',
            borderRadius: '10px',}}>
              <Button style={{width: ''}} variant="light">Главная</Button>
              <Button variant="light">Каталог</Button>
              <Button variant="light">Мой дом</Button>
              <Button variant="light">Сценарии</Button>
            </SimpleGrid>
          </Box>
          )
          
        }
      </Transition>
      

      <AppShell.Main>Main</AppShell.Main>
    </AppShell>
  );
}

function App() {

  return (
    <BasicAppShell /> 
  )
}

export default App
