import { useState } from 'react'
import { DashboardProvider } from './state/store'
import { MediaProvider } from './state/media'
import { NavContext, Shell, type ScreenId } from './components/Shell'
import { Overview } from './screens/Overview'
import { Sales } from './screens/Sales'
import { Products } from './screens/Products'
import { Stock } from './screens/Stock'
import { Finance } from './screens/Finance'
import { Customers } from './screens/Customers'
import { DataStudio } from './screens/DataStudio'
import { Rules } from './screens/Rules'

function Router() {
  const [screen, setScreen] = useState<ScreenId>('overview')

  return (
    <NavContext.Provider value={setScreen}>
    <Shell active={screen} onSelect={setScreen}>
      {screen === 'overview' && <Overview />}
      {screen === 'sales' && <Sales />}
      {screen === 'products' && <Products />}
      {screen === 'stock' && <Stock />}
      {screen === 'finance' && <Finance />}
      {screen === 'customers' && <Customers />}
      {screen === 'data' && <DataStudio />}
      {screen === 'settings' && <Rules />}
    </Shell>
    </NavContext.Provider>
  )
}

export default function App() {
  return (
    <DashboardProvider>
      <MediaProvider>
        <Router />
      </MediaProvider>
    </DashboardProvider>
  )
}
