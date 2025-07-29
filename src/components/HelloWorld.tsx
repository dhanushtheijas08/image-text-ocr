import { useState } from "react";
import { Button } from "./ui/button";

export default function HelloWorld() {
  const [count, setCount] = useState(0);
  const handleClick = () => {
    setCount(count + 1);
    console.log(`Button clicked ${count + 1} times`);
  };

  return <Button onClick={handleClick}>{count}</Button>;
}
